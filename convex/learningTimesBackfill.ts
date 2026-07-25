import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const LEARNING_TIMES_BACKFILL_VERSION = 1;

export const markLearningTimesBackfillHandled = async (
	ctx: MutationCtx,
	userId: Id<"users">,
	currentVersion?: number,
) => {
	if ((currentVersion ?? 0) >= LEARNING_TIMES_BACKFILL_VERSION) return;

	await ctx.db.patch("users", userId, {
		learningTimesBackfillVersion: LEARNING_TIMES_BACKFILL_VERSION,
	});
};

export const markLearningTimesBackfillHandledForOwner = async (
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
) => {
	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", ownerTokenIdentifier),
		)
		.unique();
	if (!user) return;

	await markLearningTimesBackfillHandled(
		ctx,
		user._id,
		user.learningTimesBackfillVersion,
	);
};
