import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const operationValidator = v.union(
	v.literal("diagnostic"),
	v.literal("plan"),
	v.literal("session_theory"),
	v.literal("session_practice"),
	v.literal("session_praxis"),
);

export const record = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		sessionId: v.optional(v.id("learningPlanSessions")),
		operation: operationValidator,
		modelId: v.string(),
		inputTokens: v.number(),
		cachedInputTokens: v.number(),
		outputTokens: v.number(),
		estimatedCostUsdMicros: v.number(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		return await ctx.db.insert("learningPlanAiUsage", {
			...args,
			ownerTokenIdentifier: identity.tokenIdentifier,
			createdAt: Date.now(),
		});
	},
});

export const getPlanCostSummary = query({
	args: { learningPlanId: v.id("learningPlans") },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		const entries = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(1_000);

		return entries.reduce(
			(summary, entry) => ({
				requestCount: summary.requestCount + 1,
				inputTokens: summary.inputTokens + entry.inputTokens,
				cachedInputTokens: summary.cachedInputTokens + entry.cachedInputTokens,
				outputTokens: summary.outputTokens + entry.outputTokens,
				estimatedCostUsdMicros:
					summary.estimatedCostUsdMicros + entry.estimatedCostUsdMicros,
			}),
			{
				requestCount: 0,
				inputTokens: 0,
				cachedInputTokens: 0,
				outputTokens: 0,
				estimatedCostUsdMicros: 0,
			},
		);
	},
});

export const getMyMonthlyCostSummary = query({
	args: { monthStart: v.number() },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const entries = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.gte("createdAt", args.monthStart),
			)
			.take(5_000);

		return {
			planCount: new Set(entries.map((entry) => entry.learningPlanId)).size,
			requestCount: entries.length,
			estimatedCostUsdMicros: entries.reduce(
				(total, entry) => total + entry.estimatedCostUsdMicros,
				0,
			),
		};
	},
});
