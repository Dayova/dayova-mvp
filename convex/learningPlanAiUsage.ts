import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const operationValidator = v.union(
	v.literal("document_extraction"),
	v.literal("diagnostic"),
	v.literal("plan"),
	v.literal("answer_evaluation"),
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
		attemptId: v.optional(v.string()),
		retryIndex: v.optional(v.number()),
		batchIndex: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		const now = Date.now();
		const usageId = await ctx.db.insert("learningPlanAiUsage", {
			learningPlanId: args.learningPlanId,
			...(args.sessionId ? { sessionId: args.sessionId } : {}),
			operation: args.operation,
			modelId: args.modelId,
			inputTokens: args.inputTokens,
			cachedInputTokens: args.cachedInputTokens,
			outputTokens: args.outputTokens,
			estimatedCostUsdMicros: args.estimatedCostUsdMicros,
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
			createdAt: now,
		});
		return usageId;
	},
});

export const recordModelRequest = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		operation: operationValidator,
		modelId: v.string(),
		attemptId: v.string(),
		retryIndex: v.number(),
		batchIndex: v.optional(v.number()),
	},
	returns: v.id("learningPlanAiModelRequests"),
	handler: async (ctx, args) => {
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan) throwUserFacingError("Lernplan nicht gefunden.");
		return await ctx.db.insert("learningPlanAiModelRequests", {
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
			...args,
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

export const removeByPlan = internalMutation({
	args: { learningPlanId: v.id("learningPlans") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const usageEntries = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(100);
		const reservations = await ctx.db
			.query("learningPlanAiBudgetReservations")
			.withIndex("by_learningPlanId_and_createdAt", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(100);
		for (const entry of usageEntries) {
			await ctx.db.delete("learningPlanAiUsage", entry._id);
		}
		for (const reservation of reservations) {
			await ctx.db.delete("learningPlanAiBudgetReservations", reservation._id);
		}
		if (usageEntries.length === 100 || reservations.length === 100) {
			await ctx.scheduler.runAfter(
				0,
				internal.learningPlanAiUsage.removeByPlan,
				{
					learningPlanId: args.learningPlanId,
				},
			);
		}
		return null;
	},
});
