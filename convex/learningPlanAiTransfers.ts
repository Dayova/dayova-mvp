import { v } from "convex/values";
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
