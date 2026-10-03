import type { QueryCtx } from "./_generated/server";
import type { LearningTimeWindow } from "./learningPlanAvailability";

/** Proposals only: never persist invented availability as a learner's choice. */
export function getDefaultLearningTimes(grade?: string): LearningTimeWindow[] {
	const level = Number(grade);
	const endTime =
		level >= 11 && level <= 13
			? "24:00"
			: level >= 9 && level <= 10
				? "22:00"
				: "20:00";
	return Array.from({ length: 7 }, (_, index) => ({
		dayOfWeek: index + 1,
		startTime: "16:00",
		endTime,
	}));
}

/** One source for availability checks, initial generation and rolling planning. */
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
	if (saved.length > 0)
		return saved.map(({ dayOfWeek, startTime, endTime }) => ({
			dayOfWeek,
			startTime,
			endTime,
		}));
	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", ownerTokenIdentifier),
		)
		.unique();
	return getDefaultLearningTimes(user?.grade);
}
