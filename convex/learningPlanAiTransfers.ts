import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const operationValidator = v.union(
	v.literal("diagnostic"),
	v.literal("plan"),
	v.literal("session_content"),
	v.literal("session_retry"),
);

export const record = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		attemptId: v.string(),
		operation: operationValidator,
		processingVersion: v.number(),
		sourceDocumentCount: v.number(),
		sourceBytes: v.number(),
		reusedDocumentCount: v.number(),
		sourceFileReadCount: v.number(),
		rawFilePartCount: v.number(),
		compactContextBytes: v.number(),
	},
	returns: v.id("learningPlanAiTransferAttempts"),
	handler: async (ctx, args) => {
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan)
			throw new Error("Learning plan not found for transfer telemetry.");
		return await ctx.db.insert("learningPlanAiTransferAttempts", {
			...args,
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
			createdAt: Date.now(),
		});
	},
});

export const removeByPlan = internalMutation({
	args: { learningPlanId: v.id("learningPlans") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const attempts = await ctx.db
			.query("learningPlanAiTransferAttempts")
			.withIndex("by_learningPlanId_and_createdAt", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(100);
		for (const attempt of attempts) {
			await ctx.db.delete("learningPlanAiTransferAttempts", attempt._id);
		}
		if (attempts.length === 100) {
			await ctx.scheduler.runAfter(
				0,
				internal.learningPlanAiTransfers.removeByPlan,
				{ learningPlanId: args.learningPlanId },
			);
		}
		return null;
	},
});
