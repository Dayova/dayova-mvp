import {
	paginationOptsValidator,
	paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertAccountActive } from "./accountDeletion";
import { getBerlinDayKey, getDayKeyQueryVariants } from "./dayKeyVariants";
import { throwUserFacingError } from "./errors";
import schema from "./schema";

const sessionFields = schema.tables.learningPlanSessions.validator.fields;
const sessionValidator = v.object({
	_id: v.id("learningPlanSessions"),
	learningPlanId: sessionFields.learningPlanId,
	title: sessionFields.title,
	startTime: sessionFields.startTime,
	durationMinutes: sessionFields.durationMinutes,
	executionStatus: sessionFields.executionStatus,
	completed: sessionFields.completed,
	goal: sessionFields.goal,
	sessionPurpose: sessionFields.sessionPurpose,
});

// Retain scan boundaries even for skipped rows: the client must finish the first
// matching day before choosing its earliest time, including legacy ISO date keys.
export const listCandidates = query({
	args: { todayKey: v.string(), paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(
		v.object({
			scanDateKey: v.string(),
			step: v.union(
				v.null(),
				v.object({
					dayKey: v.string(),
					subject: v.string(),
					session: sessionValidator,
				}),
			),
		}),
	),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		await assertAccountActive(ctx, identity.tokenIdentifier);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(args.todayKey)) {
			throwUserFacingError("Ungültiger Tag.");
		}
		const lowerBound = getDayKeyQueryVariants(args.todayKey).sort()[0];
		const result = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_ownerTokenIdentifier_and_dateKey", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.gte("dateKey", lowerBound),
			)
			.paginate(args.paginationOpts);
		const page = await Promise.all(
			result.page.map(async (session) => {
				const skipped = { scanDateKey: session.dateKey, step: null };
				const dayKey = getBerlinDayKey(session.dateKey);
				const completed = session.executionStatus
					? session.executionStatus === "completed"
					: session.completed === true;
				if (
					!dayKey ||
					dayKey < args.todayKey ||
					completed ||
					session.planningStatus === "provisional"
				)
					return skipped;
				const plan = await ctx.db.get("learningPlans", session.learningPlanId);
				if (
					!plan ||
					plan.ownerTokenIdentifier !== identity.tokenIdentifier ||
					plan.status !== "accepted"
				)
					return skipped;
				return {
					scanDateKey: session.dateKey,
					step: {
						dayKey,
						subject: plan.subject,
						session: {
							_id: session._id,
							learningPlanId: session.learningPlanId,
							title: session.title,
							startTime: session.startTime,
							durationMinutes: session.durationMinutes,
							goal: session.goal,
							executionStatus: session.executionStatus,
							completed: session.completed,
							sessionPurpose: session.sessionPurpose,
						},
					},
				};
			}),
		);
		return { ...result, page };
	},
});
