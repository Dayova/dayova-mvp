import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const rejectionReasonValidator = v.union(
	v.literal("too_many_files"),
	v.literal("file_too_large"),
	v.literal("total_too_large"),
	v.literal("unsupported_type"),
	v.literal("empty_file"),
);

const fileSizeBucket = (fileSizeBytes: number) => {
	if (fileSizeBytes < 1024 * 1024) return "lt_1_mib" as const;
	if (fileSizeBytes <= 7 * 1024 * 1024) return "1_to_7_mib" as const;
	return "gt_7_mib" as const;
};

export const recordRejection = internalMutation({
	args: {
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		fileSizeBytes: v.number(),
		fileType: v.string(),
		reason: rejectionReasonValidator,
		existingFileCount: v.number(),
		existingTotalBytes: v.number(),
	},
	returns: v.id("learningPlanUploadRejections"),
	handler: async (ctx, args) =>
		await ctx.db.insert("learningPlanUploadRejections", {
			...args,
			fileSizeBucket: fileSizeBucket(args.fileSizeBytes),
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
