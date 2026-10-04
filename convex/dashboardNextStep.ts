import {
	paginationOptsValidator,
	paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { getBerlinDayKey } from "./dayKeyVariants";
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

/** Switch query arguments only after this owner's backfill is complete, resetting pagination. */
export const isDayIndexReady = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const missing = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_ownerTokenIdentifier_and_berlinDayKey", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.eq("berlinDayKey", undefined),
			)
			.first();
		return missing === null;
	},
});

/** Indexed pages are chronological. Legacy clients retain the full-scan contract. */
export const listCandidates = query({
	args: {
		todayKey: v.string(),
		paginationOpts: paginationOptsValidator,
		useDayIndex: v.optional(v.boolean()),
	},
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
		if (!/^\d{4}-\d{2}-\d{2}$/.test(args.todayKey)) {
			throwUserFacingError("Ungültiger Tag.");
		}
		const sessions = ctx.db.query("learningPlanSessions");
		const range = args.useDayIndex
			? sessions.withIndex("by_ownerTokenIdentifier_and_berlinDayKey", (q) =>
					q
						.eq("ownerTokenIdentifier", identity.tokenIdentifier)
						.gte("berlinDayKey", args.todayKey),
				)
			: sessions.withIndex("by_ownerTokenIdentifier", (q) =>
					q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
				);
		const result = await range.paginate(args.paginationOpts);
		const page = await Promise.all(
			result.page.map(async (session) => {
				const dayKey = getBerlinDayKey(session.dateKey);
				const scanDateKey = args.useDayIndex
					? (session.berlinDayKey ?? "")
					: session.dateKey;
				const skipped = { scanDateKey, step: null };
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
					scanDateKey,
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
