import type { QueryCtx } from "./_generated/server";
import type { LearningTimeWindow } from "./learningPlanAvailability";

/** Only learner-saved windows count as availability, including when none exist. */
export async function getPlanningLearningTimes(
	ctx: Pick<QueryCtx, "db">,
	ownerTokenIdentifier: string,
): Promise<LearningTimeWindow[]> {
	const saved = await ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
		)
		.take(50);
	return saved.map(({ dayOfWeek, startTime, endTime }) => ({
		dayOfWeek,
		startTime,
		endTime,
	}));
}
