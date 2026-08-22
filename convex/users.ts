import { v } from "convex/values";
import {
	GERMAN_FEDERAL_STATES,
	isGermanFederalState,
} from "../src/lib/federal-states";
import { GRADE_OPTIONS, isSupportedGrade } from "../src/lib/grades";
import {
	isSupportedSchoolType,
	normalizeLegacySchoolType,
	SCHOOL_TYPE_VALUES,
} from "../src/lib/school-types";
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
import {
	LEARNING_TIMES_BACKFILL_VERSION,
	markLearningTimesBackfillHandled,
} from "./learningTimesBackfill";

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
const ONBOARDING_PERSISTED_ANSWER_KEYS = [
	"state",
	"schoolType",
	"grade",
	...ONBOARDING_LEARNING_TIME_KEYS,
] as const satisfies readonly OnboardingQuestionKey[];

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
		options: [...GERMAN_FEDERAL_STATES],
	},
	{
		key: "schoolType",
		prompt: "Welche Schulart besuchst du?",
		kind: "select" as const,
		order: 5,
		options: [...SCHOOL_TYPE_VALUES],
	},
	{
		key: "grade",
		prompt: "Welche Klassenstufe besuchst du?",
		kind: "select" as const,
		order: 6,
		options: [...GRADE_OPTIONS],
	},
	{
		key: "dailySchoolTime",
		prompt: "Wie lange möchtest du pro Lerntag einplanen?",
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
		prompt: "Wann möchtest du an diesen Tagen starten?",
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

const hasLearningTimes = async (
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
) => {
	const existing = await ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
		)
		.take(1);
	return existing.length > 0;
};

const insertLearningTimesWhenAbsent = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		input: OnboardingLearningTimeInput;
		invalidInput: "reject" | "skip";
	},
) => {
	const derived = deriveOnboardingLearningTimes(args.input);
	if (!derived.ok) {
		if (args.invalidInput === "reject") {
			throwUserFacingError(
				getOnboardingLearningTimeErrorMessage(derived.reason),
			);
		}
		return { status: "needsSetup" as const, createdCount: 0 };
	}

	if (await hasLearningTimes(ctx, args.ownerTokenIdentifier)) {
		return { status: "preserved" as const, createdCount: 0 };
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
	args: {
		userId: Id<"users">;
		ownerTokenIdentifier: string;
		currentVersion?: number;
	},
) => {
	if ((args.currentVersion ?? 0) >= LEARNING_TIMES_BACKFILL_VERSION) {
		return;
	}

	const markHandled = () =>
		markLearningTimesBackfillHandled(ctx, args.userId, args.currentVersion);

	if (await hasLearningTimes(ctx, args.ownerTokenIdentifier)) {
		await markHandled();
		return;
	}

	const legacy: Partial<OnboardingLearningTimeInput> = {};
	for (const key of ONBOARDING_LEARNING_TIME_KEYS) {
		const questions = await ctx.db
			.query("onboardingQuestions")
			.withIndex("by_key", (q) => q.eq("key", key))
			.take(2);
		if (questions.length === 0) return;
		if (questions.length > 1) {
			await markHandled();
			return;
		}
		const question = questions[0];

		const answers = await ctx.db
			.query("userOnboardingAnswers")
			.withIndex("by_userId_and_questionId", (q) =>
				q.eq("userId", args.userId).eq("questionId", question._id),
			)
			.take(2);
		if (answers.length === 0) return;
		if (answers.length > 1) {
			await markHandled();
			return;
		}
		legacy[key] = answers[0].answer;
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
	await markHandled();
};

const normalizeOptionalGrade = (grade?: string) => {
	const normalizedGrade = grade?.trim();
	if (!normalizedGrade) return undefined;
	if (!isSupportedGrade(normalizedGrade)) {
		throwUserFacingError("Bitte wähle eine gültige Klassenstufe aus.");
	}
	return normalizedGrade;
};

const normalizeOptionalFederalState = (state?: string) => {
	const normalizedState = state?.trim();
	if (!normalizedState) return undefined;
	if (!isGermanFederalState(normalizedState)) {
		throwUserFacingError("Bitte wähle ein gültiges Bundesland aus.");
	}
	return normalizedState;
};

const normalizeOptionalSchoolType = (schoolType?: string) => {
	const normalizedSchoolType = schoolType?.trim();
	if (!normalizedSchoolType) return undefined;
	if (!isSupportedSchoolType(normalizedSchoolType)) {
		throwUserFacingError("Bitte wähle eine gültige Schulart aus.");
	}
	return normalizedSchoolType;
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
}) => {
	const grade = normalizeOptionalGrade(args.grade);
	const schoolType = normalizeOptionalSchoolType(args.schoolType);
	const state = normalizeOptionalFederalState(args.state);
	return {
		...(args.email !== undefined ? { email: normalizeEmail(args.email) } : {}),
		...(args.name !== undefined ? { name: args.name } : {}),
		...(args.phone !== undefined ? { phone: args.phone } : {}),
		...(args.birthDate !== undefined ? { birthDate: args.birthDate } : {}),
		...(grade !== undefined ? { grade } : {}),
		...(schoolType !== undefined ? { schoolType } : {}),
		...(state !== undefined ? { state } : {}),
		...(args.avatarUrl !== undefined ? { avatarUrl: args.avatarUrl } : {}),
		...(args.validationStudentCode !== undefined
			? { validationStudentCode: args.validationStudentCode }
			: {}),
	};
};

const sanitizeLegacyOnboardingSchoolType = async (
	ctx: MutationCtx,
	userId: Id<"users">,
) => {
	const question = await ctx.db
		.query("onboardingQuestions")
		.withIndex("by_key", (q) => q.eq("key", "schoolType"))
		.unique();
	if (!question) return;

	const answer = await ctx.db
		.query("userOnboardingAnswers")
		.withIndex("by_userId_and_questionId", (q) =>
			q.eq("userId", userId).eq("questionId", question._id),
		)
		.unique();
	if (!answer) return;

	const schoolType = normalizeLegacySchoolType(answer.answer);
	if (!schoolType) {
		await ctx.db.delete("userOnboardingAnswers", answer._id);
		return;
	}
	if (schoolType !== answer.answer) {
		await ctx.db.patch("userOnboardingAnswers", answer._id, {
			answer: schoolType,
		});
	}
};

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
			const schoolType =
				args.schoolType === undefined
					? normalizeLegacySchoolType(existingUser.schoolType)
					: user.schoolType;
			await ctx.db.patch("users", existingUser._id, {
				...user,
				schoolType,
			});
			await sanitizeLegacyOnboardingSchoolType(ctx, existingUser._id);
			userId = existingUser._id;
		} else {
			userId = await ctx.db.insert("users", user);
		}

		await backfillLegacyLearningTimes(ctx, {
			userId,
			ownerTokenIdentifier: identity.tokenIdentifier,
			currentVersion: existingUser?.learningTimesBackfillVersion,
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
			// Accepted temporarily for older installed clients. These decorative
			// answers are intentionally excluded from ONBOARDING_PERSISTED_ANSWER_KEYS.
			studyTime: v.optional(v.string()),
			strength: v.optional(v.string()),
			challenge: v.optional(v.string()),
			goal: v.optional(v.string()),
			state: v.string(),
			schoolType: v.string(),
			grade: v.string(),
			dailySchoolTime: v.optional(v.string()),
			studyDays: v.optional(v.string()),
			learningTime: v.optional(v.string()),
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
		const normalizedGrade = normalizeOptionalGrade(args.answers.grade);
		if (!normalizedGrade) {
			throwUserFacingError("Bitte wähle eine gültige Klassenstufe aus.");
		}
		const normalizedSchoolType = normalizeOptionalSchoolType(
			args.answers.schoolType,
		);
		if (!normalizedSchoolType) {
			throwUserFacingError("Bitte wähle eine gültige Schulart aus.");
		}
		const normalizedState = normalizeOptionalFederalState(args.answers.state);
		if (!normalizedState) {
			throwUserFacingError("Bitte wähle ein gültiges Bundesland aus.");
		}

		const legacyLearningTimeInput: OnboardingLearningTimeInput = {
			studyDays: args.answers.studyDays?.trim() ?? "",
			learningTime: args.answers.learningTime?.trim() ?? "",
			dailySchoolTime: args.answers.dailySchoolTime?.trim() ?? "",
		};
		const suppliedLearningTimeValues = Object.values(
			legacyLearningTimeInput,
		).filter(Boolean).length;
		if (suppliedLearningTimeValues > 0 && suppliedLearningTimeValues < 3) {
			throwUserFacingError(
				"Bitte vervollständige deine Lerntage, Uhrzeit und tägliche Lernzeit.",
			);
		}
		const learningTimes =
			suppliedLearningTimeValues === 3
				? await insertLearningTimesWhenAbsent(ctx, {
						ownerTokenIdentifier: identity.tokenIdentifier,
						input: legacyLearningTimeInput,
						invalidInput: "reject",
					})
				: { createdCount: 0 };
		await markLearningTimesBackfillHandled(
			ctx,
			user._id,
			user.learningTimesBackfillVersion,
		);

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

		for (const key of ONBOARDING_PERSISTED_ANSWER_KEYS) {
			const answer = args.answers[key];
			if (answer === undefined) continue;
			const normalizedAnswer =
				key === "grade"
					? normalizedGrade
					: key === "state"
						? normalizedState
						: key === "schoolType"
							? normalizedSchoolType
							: answer.trim();
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
