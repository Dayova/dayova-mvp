import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const recordRejection = internalMutation({
	args: {
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		fileSizeBytes: v.number(),
		fileType: v.string(),
		reason: v.literal("registration_rejected"),
	},
	returns: v.id("learningPlanUploadRejections"),
	handler: async (ctx, args) =>
		await ctx.db.insert("learningPlanUploadRejections", {
			...args,
			createdAt: Date.now(),
		}),
});

export const removeByPlan = internalMutation({
	args: { learningPlanId: v.id("learningPlans") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const rejections = await ctx.db
			.query("learningPlanUploadRejections")
			.withIndex("by_learningPlanId_and_createdAt", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(100);
		for (const rejection of rejections) {
			await ctx.db.delete("learningPlanUploadRejections", rejection._id);
		}
		if (rejections.length === 100) {
			await ctx.scheduler.runAfter(
				0,
				internal.learningPlanUploadTelemetry.removeByPlan,
				{ learningPlanId: args.learningPlanId },
			);
		}
		return null;
	},
});
