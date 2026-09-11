import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type GenerationStage = "content" | "validating" | "ready" | "failed";

export const setLearningPlanGenerationProgress = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		learningPlanId: Id<"learningPlans">;
		stage: GenerationStage;
		generationId?: string;
		startedAt?: number;
		updatedAt: number;
	},
) => {
	const existing = await ctx.db
		.query("learningPlanGenerationProgress")
		.withIndex("by_learningPlanId", (q) =>
			q.eq("learningPlanId", args.learningPlanId),
		)
		.unique();
	const value = {
		ownerTokenIdentifier: args.ownerTokenIdentifier,
		learningPlanId: args.learningPlanId,
		stage: args.stage,
		generationId: args.generationId,
		startedAt: args.startedAt,
		updatedAt: args.updatedAt,
	};
	if (existing) {
		await ctx.db.patch("learningPlanGenerationProgress", existing._id, value);
		return existing._id;
	}
	return await ctx.db.insert("learningPlanGenerationProgress", value);
};

export const getLearningPlanGenerationProgress = async (
	ctx: MutationCtx,
	learningPlanId: Id<"learningPlans">,
) =>
	await ctx.db
		.query("learningPlanGenerationProgress")
		.withIndex("by_learningPlanId", (q) =>
			q.eq("learningPlanId", learningPlanId),
		)
		.unique();

export const clearLearningPlanGenerationProgress = async (
	ctx: MutationCtx,
	learningPlanId: Id<"learningPlans">,
) => {
	const existing = await ctx.db
		.query("learningPlanGenerationProgress")
		.withIndex("by_learningPlanId", (q) =>
			q.eq("learningPlanId", learningPlanId),
		)
		.unique();
	if (existing)
		await ctx.db.delete("learningPlanGenerationProgress", existing._id);
};
