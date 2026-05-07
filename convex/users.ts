import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const normalizeEmail = (email?: string) => email?.trim().toLowerCase() ?? "";
type OnboardingQuestionKey =
	| "studyTime"
	| "strength"
	| "challenge"
	| "goal"
	| "state";

const DEFAULT_ONBOARDING_QUESTIONS: Array<{
	key: OnboardingQuestionKey;
	prompt: string;
	kind: "select" | "input";
	order: number;
	options?: string[];
}> = [
	{
		key: "studyTime",
		prompt: "Wie viel lernst du aktuell pro Tag?",
		kind: "select" as const,
		order: 0,
		options: [
			"Unter 30 Min.",
			"30 bis 60 Min.",
			"1 bis 2 Stunden",
			"Mehr als 2 Stunden",
		],
	},
	{
		key: "strength",
		prompt: "Wo liegen deine Stärken?",
		kind: "select" as const,
		order: 1,
		options: [
			"Sprachen",
			"Mathematik",
			"Naturwissenschaften",
			"Kreative Fächer",
		],
	},
	{
		key: "challenge",
		prompt: "Was sind deine größten Baustellen in der Schule",
		kind: "select" as const,
		order: 2,
		options: ["Konzentration", "Motivation", "Organisation", "Prüfungsstress"],
	},
	{
		key: "goal",
		prompt: "Was möchtest du mit uns erreichen?",
		kind: "select" as const,
		order: 3,
		options: [
			"Bessere Noten",
			"Mehr Struktur",
			"Weniger Stress",
			"Konstant dranbleiben",
		],
	},
	{
		key: "state",
		prompt: "Aus welchem Bundesland kommst du?",
		kind: "input" as const,
		order: 4,
	},
];

const requireIdentity = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Nicht authentifiziert.");
	}
	return identity;
};

const profileFields = (args: {
	name?: string;
	phone?: string;
	birthDate?: string;
	avatarUrl?: string;
}) => ({
	...(args.name !== undefined ? { name: args.name } : {}),
	...(args.phone !== undefined ? { phone: args.phone } : {}),
	...(args.birthDate !== undefined ? { birthDate: args.birthDate } : {}),
	...(args.avatarUrl !== undefined ? { avatarUrl: args.avatarUrl } : {}),
});

export const syncCurrentUser = mutation({
	args: {
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		birthDate: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
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
			throw new Error("Beim angemeldeten Konto fehlt die E-Mail-Adresse.");
		}

		const user = {
			tokenIdentifier: identity.tokenIdentifier,
			clerkId: identity.subject,
			email,
			name: args.name ?? identity.name,
			...profileFields(args),
		};

		if (existingUser) {
			await ctx.db.patch("users", existingUser._id, user);
			return existingUser._id;
		}

		return await ctx.db.insert("users", user);
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
			throw new Error("Der Nutzer konnte nicht gefunden werden.");
		}

		const questionIdsByKey: Partial<
			Record<OnboardingQuestionKey, Id<"onboardingQuestions">>
		> = {};
		for (const question of DEFAULT_ONBOARDING_QUESTIONS) {
			const existingQuestion = await ctx.db
				.query("onboardingQuestions")
				.withIndex("by_key", (q) => q.eq("key", question.key))
				.unique();

			if (existingQuestion) {
				await ctx.db.patch(existingQuestion._id, {
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
				await ctx.db.patch(existingAnswer._id, { answer: normalizedAnswer });
				continue;
			}

			await ctx.db.insert("userOnboardingAnswers", {
				userId: user._id,
				questionId,
				answer: normalizedAnswer,
			});
		}

		return { success: true };
	},
});
