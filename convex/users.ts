import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";
import {
	deriveOnboardingLearningTimes,
	getOnboardingLearningTimeErrorMessage,
	ONBOARDING_DURATION_MINUTES,
	type OnboardingLearningTimeInput,
} from "./learningTimeAvailability";

const normalizeEmail = (email?: string) => email?.trim().toLowerCase() ?? "";
const DURATION_OPTIONS = ONBOARDING_DURATION_MINUTES.map(
	(minutes) => `${minutes} min`,
);
type OnboardingQuestionKey =
	| "studyTime"
	| "strength"
	| "challenge"
	| "goal"
	| "state"
	| "schoolType"
	| "grade"
	| "dailySchoolTime"
	| "studyDays"
	| "learningTime";
const ONBOARDING_LEARNING_TIME_KEYS = [
	"studyDays",
	"learningTime",
	"dailySchoolTime",
] as const;

const DEFAULT_ONBOARDING_QUESTIONS: Array<{
	key: OnboardingQuestionKey;
	prompt: string;
	kind: "select" | "input";
	order: number;
	options?: string[];
}> = [
	// This metadata mirrors the mobile onboarding flow. Keep labels exhaustive
	// and aligned because answers are stored as user-facing strings.
	{
		key: "studyTime",
		prompt: "Wie viel lernst du aktuell pro Tag?",
		kind: "select" as const,
		order: 0,
		options: [...DURATION_OPTIONS],
	},
	{
		key: "strength",
		prompt: "Wo liegen deine Stärken?",
		kind: "select" as const,
		order: 1,
		options: [
			"Mathe",
			"Geographie",
			"Kunst",
			"Physik",
			"Sprachen",
			"Biologie",
			"Astronomie",
			"Chemie",
			"Deutsch",
			"Politik",
			"Sport",
			"Geschichte",
		],
	},
	{
		key: "challenge",
		prompt: "Was sind deine größten Baustellen in der Schule?",
		kind: "select" as const,
		order: 2,
		options: [
			"Mündlich erklären",
			"Aufschieben",
			"Rechnen",
			"Schreiben",
			"Konzentration",
			"Motivation",
			"Vokabeln",
			"Ablenkung",
			"Zeitmanagement",
			"Prüfungsangst",
			"Organisation",
		],
	},
	{
		key: "goal",
		prompt: "Was möchtest du mit uns erreichen?",
		kind: "select" as const,
		order: 3,
		options: [
			"Bessere Noten",
			"Weniger Aufschieben",
			"Prüfung sicher bestehen",
			"Lernlücke schließen",
			"Mehr Struktur im Lernen",
			"Dranbleiben",
			"Besser vorbereitet sein",
		],
	},
	{
		key: "state",
		prompt: "Aus welchem Bundesland kommst du?",
		kind: "select" as const,
		order: 4,
		options: [
			"Bremen",
			"Hamburg",
			"Baden-Württemberg",
			"Sachsen",
			"Sachsen-Anhalt",
			"Brandenburg",
			"Bayern",
			"Berlin",
			"Hessen",
			"Niedersachsen",
			"Nordrhein-Westfalen",
			"Rheinland-Pfalz",
			"Saarland",
			"Schleswig-Holstein",
			"Thüringen",
			"Mecklenburg-Vorpommern",
		],
	},
	{
		key: "schoolType",
		prompt: "Welche Schule besuchst du?",
		kind: "input" as const,
		order: 5,
	},
	{
		key: "grade",
		prompt: "Welche Klassenstufe besuchst du?",
		kind: "select" as const,
		order: 6,
		options: ["6", "7", "8", "9", "10", "11", "12"],
	},
	{
		key: "dailySchoolTime",
		prompt: "Wie viel Zeit willst du pro Tag für die Schule aufwenden?",
		kind: "select" as const,
		order: 7,
		options: [...DURATION_OPTIONS],
	},
	{
		key: "studyDays",
		prompt: "An welchen Tagen kannst du lernen?",
		kind: "select" as const,
		order: 8,
		options: [
			"Montag",
			"Dienstag",
			"Mittwoch",
			"Donnerstag",
			"Freitag",
			"Samstag",
			"Sonntag",
		],
	},
	{
		key: "learningTime",
		prompt: "Wann ist die beste Uhrzeit für dich zum Lernen?",
		kind: "input" as const,
		order: 9,
	},
];

const requireIdentity = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throwUserFacingError("Nicht authentifiziert.");
	}
	return identity;
};

const insertLearningTimesWhenAbsent = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		input: OnboardingLearningTimeInput;
		invalidInput: "reject" | "skip";
	},
) => {
	const existing = await ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", args.ownerTokenIdentifier),
		)
		.take(1);
	if (existing.length > 0) {
		return { status: "preserved" as const, createdCount: 0 };
	}

	const derived = deriveOnboardingLearningTimes(args.input);
	if (!derived.ok) {
		if (args.invalidInput === "reject") {
			throwUserFacingError(
				getOnboardingLearningTimeErrorMessage(derived.reason),
			);
		}
		return { status: "needsSetup" as const, createdCount: 0 };
	}

	const now = Date.now();
	for (const window of derived.windows) {
		await ctx.db.insert("userLearningTimes", {
			ownerTokenIdentifier: args.ownerTokenIdentifier,
			...window,
			createdAt: now,
			updatedAt: now,
		});
	}

	return {
		status: "created" as const,
		createdCount: derived.windows.length,
	};
};

const backfillLegacyLearningTimes = async (
	ctx: MutationCtx,
	args: { userId: Id<"users">; ownerTokenIdentifier: string },
) => {
	const existing = await ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", args.ownerTokenIdentifier),
		)
		.take(1);
	if (existing.length > 0) return;

	const legacy: Partial<OnboardingLearningTimeInput> = {};
	for (const key of ONBOARDING_LEARNING_TIME_KEYS) {
		const question = await ctx.db
			.query("onboardingQuestions")
			.withIndex("by_key", (q) => q.eq("key", key))
			.unique();
		if (!question) continue;

		const answer = await ctx.db
			.query("userOnboardingAnswers")
			.withIndex("by_userId_and_questionId", (q) =>
				q.eq("userId", args.userId).eq("questionId", question._id),
			)
			.unique();
		if (answer) legacy[key] = answer.answer;
	}

	if (
		legacy.studyDays === undefined ||
		legacy.learningTime === undefined ||
		legacy.dailySchoolTime === undefined
	) {
		return;
	}

	await insertLearningTimesWhenAbsent(ctx, {
		ownerTokenIdentifier: args.ownerTokenIdentifier,
		input: {
			studyDays: legacy.studyDays,
			learningTime: legacy.learningTime,
			dailySchoolTime: legacy.dailySchoolTime,
		},
		invalidInput: "skip",
	});
};

const profileFields = (args: {
	email?: string;
	name?: string;
	phone?: string;
	birthDate?: string;
	grade?: string;
	schoolType?: string;
	state?: string;
	avatarUrl?: string;
	validationStudentCode?: string;
}) => ({
	...(args.email !== undefined ? { email: normalizeEmail(args.email) } : {}),
	...(args.name !== undefined ? { name: args.name } : {}),
	...(args.phone !== undefined ? { phone: args.phone } : {}),
	...(args.birthDate !== undefined ? { birthDate: args.birthDate } : {}),
	...(args.grade !== undefined ? { grade: args.grade } : {}),
	...(args.schoolType !== undefined ? { schoolType: args.schoolType } : {}),
	...(args.state !== undefined ? { state: args.state } : {}),
	...(args.avatarUrl !== undefined ? { avatarUrl: args.avatarUrl } : {}),
	...(args.validationStudentCode !== undefined
		? { validationStudentCode: args.validationStudentCode }
		: {}),
});

export const syncCurrentUser = mutation({
	args: {
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		birthDate: v.optional(v.string()),
		grade: v.optional(v.string()),
		schoolType: v.optional(v.string()),
		state: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
		validationStudentCode: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);

		const existingUser = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		const email = normalizeEmail(identity.email) || existingUser?.email;

		if (!email) {
			throwUserFacingError("Beim angemeldeten Konto fehlt die E-Mail-Adresse.");
		}

		const user = {
			tokenIdentifier: identity.tokenIdentifier,
			clerkId: identity.subject,
			email,
			name: args.name ?? identity.name,
			...profileFields(args),
		};

		let userId: Id<"users">;
		if (existingUser) {
			await ctx.db.patch("users", existingUser._id, user);
			userId = existingUser._id;
		} else {
			userId = await ctx.db.insert("users", user);
		}

		await backfillLegacyLearningTimes(ctx, {
			userId,
			ownerTokenIdentifier: identity.tokenIdentifier,
		});
		return userId;
	},
});

export const updateProfile = mutation({
	args: {
		email: v.optional(v.string()),
		name: v.optional(v.string()),
		birthDate: v.optional(v.string()),
		grade: v.optional(v.string()),
		schoolType: v.optional(v.string()),
		state: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);
		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (!user) {
			throwUserFacingError("Der Nutzer konnte nicht gefunden werden.");
		}

		await ctx.db.patch("users", user._id, profileFields(args));
		return { success: true };
	},
});

export const getMe = query({
	args: {},
	handler: async (ctx) => {
		const identity = await requireIdentity(ctx);

		return await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();
	},
});

export const saveOnboardingAnswers = mutation({
	args: {
		answers: v.object({
			studyTime: v.string(),
			strength: v.string(),
			challenge: v.string(),
			goal: v.string(),
			state: v.string(),
			schoolType: v.string(),
			grade: v.string(),
			dailySchoolTime: v.string(),
			studyDays: v.string(),
			learningTime: v.string(),
		}),
	},
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);
		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (!user) {
			throwUserFacingError("Der Nutzer konnte nicht gefunden werden.");
		}

		const learningTimes = await insertLearningTimesWhenAbsent(ctx, {
			ownerTokenIdentifier: identity.tokenIdentifier,
			input: {
				studyDays: args.answers.studyDays,
				learningTime: args.answers.learningTime,
				dailySchoolTime: args.answers.dailySchoolTime,
			},
			invalidInput: "reject",
		});

		const questionIdsByKey: Partial<
			Record<OnboardingQuestionKey, Id<"onboardingQuestions">>
		> = {};
		for (const question of DEFAULT_ONBOARDING_QUESTIONS) {
			const existingQuestion = await ctx.db
				.query("onboardingQuestions")
				.withIndex("by_key", (q) => q.eq("key", question.key))
				.unique();

			if (existingQuestion) {
				await ctx.db.patch("onboardingQuestions", existingQuestion._id, {
					prompt: question.prompt,
					kind: question.kind,
					order: question.order,
					options: question.options,
				});
				questionIdsByKey[question.key] = existingQuestion._id;
				continue;
			}

			const questionId = await ctx.db.insert("onboardingQuestions", {
				key: question.key,
				prompt: question.prompt,
				kind: question.kind,
				order: question.order,
				options: question.options,
			});
			questionIdsByKey[question.key] = questionId;
		}

		for (const [key, answer] of Object.entries(args.answers) as Array<
			[keyof typeof args.answers, string]
		>) {
			const normalizedAnswer = answer.trim();
			if (!normalizedAnswer) continue;

			const questionId = questionIdsByKey[key];
			if (!questionId) continue;

			const existingAnswer = await ctx.db
				.query("userOnboardingAnswers")
				.withIndex("by_userId_and_questionId", (q) =>
					q.eq("userId", user._id).eq("questionId", questionId),
				)
				.unique();

			if (existingAnswer) {
				await ctx.db.patch("userOnboardingAnswers", existingAnswer._id, {
					answer: normalizedAnswer,
				});
				continue;
			}

			await ctx.db.insert("userOnboardingAnswers", {
				userId: user._id,
				questionId,
				answer: normalizedAnswer,
			});
		}

		return {
			success: true,
			learningTimesCreated: learningTimes.createdCount,
		};
	},
});
