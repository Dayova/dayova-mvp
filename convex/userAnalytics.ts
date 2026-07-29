import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const analyticsPeriodValidator = v.union(
	v.literal("week"),
	v.literal("month"),
	v.literal("all"),
);

const activityPointValidator = v.object({
	dayKey: v.string(),
	completedSessions: v.number(),
	activeStudyMinutes: v.number(),
});

const planProgressValidator = v.object({
	id: v.id("learningPlans"),
	subject: v.string(),
	examTypeLabel: v.string(),
	examDateKey: v.string(),
	examDateLabel: v.string(),
	progressPercent: v.number(),
	completedSessions: v.number(),
	totalSessions: v.number(),
});

const nextSessionValidator = v.object({
	id: v.id("learningPlanSessions"),
	learningPlanId: v.id("learningPlans"),
	subject: v.string(),
	title: v.string(),
	dateKey: v.string(),
});

const overviewValidator = v.object({
	hasData: v.boolean(),
	historyLimited: v.boolean(),
	overall: v.object({
		acceptedPlans: v.number(),
		finishedPlans: v.number(),
		completedSessions: v.number(),
		totalSessions: v.number(),
		progressPercent: v.number(),
	}),
	period: v.object({
		completedSessions: v.number(),
		activeStudyMinutes: v.number(),
		recoveredSessions: v.number(),
	}),
	currentStreakDays: v.number(),
	activity: v.array(activityPointValidator),
	plans: v.array(planProgressValidator),
	nextSession: v.union(nextSessionValidator, v.null()),
	knowledge: v.object({
		answeredItems: v.number(),
		correct: v.number(),
		partiallyCorrect: v.number(),
		notCorrect: v.number(),
		scorePercent: v.union(v.number(), v.null()),
		strengths: v.array(v.string()),
		gaps: v.array(v.string()),
		recommendation: v.union(v.string(), v.null()),
	}),
});

type AnalyticsPeriod = "week" | "month" | "all";
type SessionStatus =
	| "notStarted"
	| "started"
	| "completed"
	| "partiallyCompleted"
	| "missed"
	| "adjusted";

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_PLANS = 50;
const MAX_SESSIONS_PER_PLAN = 75;
const MAX_ATTEMPTS = 5_000;
const MAX_ANALYSES = 500;

const parseDayKey = (dayKey: string) => {
	const match = DAY_KEY_PATTERN.exec(dayKey);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const timestamp = Date.UTC(year, month - 1, day);
	const parsed = new Date(timestamp);
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() !== month - 1 ||
		parsed.getUTCDate() !== day
	) {
		return null;
	}
	return timestamp;
};

const formatDayKey = (timestamp: number) => {
	const date = new Date(timestamp);
	return [
		date.getUTCFullYear(),
		(date.getUTCMonth() + 1).toString().padStart(2, "0"),
		date.getUTCDate().toString().padStart(2, "0"),
	].join("-");
};

const addDays = (dayKey: string, days: number) => {
	const timestamp = parseDayKey(dayKey);
	if (timestamp === null) return null;
	return formatDayKey(timestamp + days * 86_400_000);
};

const timestampToDayKey = (timestamp: number, timezoneOffsetMinutes: number) =>
	formatDayKey(timestamp - timezoneOffsetMinutes * 60_000);

const getSessionStatus = (
	session: Doc<"learningPlanSessions">,
): SessionStatus =>
	session.executionStatus ?? (session.completed ? "completed" : "notStarted");

const isWithinPeriod = (
	timestamp: number,
	startDayKey: string | null,
	endDayKey: string,
	timezoneOffsetMinutes: number,
) => {
	const dayKey = timestampToDayKey(timestamp, timezoneOffsetMinutes);
	return (startDayKey === null || dayKey >= startDayKey) && dayKey <= endDayKey;
};

const getPeriodStartDayKey = (period: AnalyticsPeriod, todayKey: string) => {
	if (period === "all") return null;
	return addDays(todayKey, period === "week" ? -6 : -29);
};

const getCurrentStreak = (completedDayKeys: Set<string>, todayKey: string) => {
	const yesterdayKey = addDays(todayKey, -1);
	let cursor = completedDayKeys.has(todayKey)
		? todayKey
		: yesterdayKey && completedDayKeys.has(yesterdayKey)
			? yesterdayKey
			: null;
	let streak = 0;

	while (cursor && completedDayKeys.has(cursor)) {
		streak += 1;
		cursor = addDays(cursor, -1);
	}
	return streak;
};

const uniqueRecentStrings = (values: string[], limit: number) => {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const rawValue of values) {
		const value = rawValue.trim();
		const key = value.toLocaleLowerCase("de-DE");
		if (!value || seen.has(key)) continue;
		seen.add(key);
		result.push(value);
		if (result.length >= limit) break;
	}
	return result;
};

export const getOverview = query({
	args: {
		period: analyticsPeriodValidator,
		todayKey: v.string(),
		timezoneOffsetMinutes: v.number(),
	},
	returns: overviewValidator,
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throwUserFacingError("Nicht authentifiziert.");
		}
		if (parseDayKey(args.todayKey) === null) {
			throwUserFacingError("Ungültiger Kalendertag.");
		}
		if (
			!Number.isInteger(args.timezoneOffsetMinutes) ||
			Math.abs(args.timezoneOffsetMinutes) > 14 * 60
		) {
			throwUserFacingError("Ungültige Zeitzone.");
		}

		const ownerTokenIdentifier = identity.tokenIdentifier;
		const plans = await ctx.db
			.query("learningPlans")
			.withIndex("by_ownerTokenIdentifier_and_status", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("status", "accepted"),
			)
			.order("desc")
			.take(MAX_PLANS);

		const sessionsByPlan = await Promise.all(
			plans.map((plan) =>
				ctx.db
					.query("learningPlanSessions")
					.withIndex("by_learningPlanId_and_sortOrder", (q) =>
						q.eq("learningPlanId", plan._id),
					)
					.order("asc")
					.take(MAX_SESSIONS_PER_PLAN),
			),
		);
		const sessions = sessionsByPlan.flat();
		const planById = new Map(plans.map((plan) => [plan._id, plan]));
		const periodStartDayKey = getPeriodStartDayKey(args.period, args.todayKey);
		const activityStartDayKey =
			periodStartDayKey ?? addDays(args.todayKey, -29);
		if (!activityStartDayKey) {
			throwUserFacingError("Ungültiger Analysezeitraum.");
		}

		const effectiveSessions = sessions.filter(
			(session) => getSessionStatus(session) !== "adjusted",
		);
		const completedSessions = effectiveSessions.filter(
			(session) => getSessionStatus(session) === "completed",
		);
		const completedDayKeys = new Set(
			completedSessions.flatMap((session) =>
				session.outcomeAt
					? [timestampToDayKey(session.outcomeAt, args.timezoneOffsetMinutes)]
					: [],
			),
		);
		const periodSessions = effectiveSessions.filter(
			(session) =>
				session.outcomeAt !== undefined &&
				isWithinPeriod(
					session.outcomeAt,
					periodStartDayKey,
					args.todayKey,
					args.timezoneOffsetMinutes,
				),
		);
		const periodCompletedSessions = periodSessions.filter(
			(session) => getSessionStatus(session) === "completed",
		);

		const activityByDay = new Map<
			string,
			{ completedSessions: number; activeStudySeconds: number }
		>();
		for (let cursor: string | null = activityStartDayKey; cursor; ) {
			activityByDay.set(cursor, {
				completedSessions: 0,
				activeStudySeconds: 0,
			});
			if (cursor === args.todayKey) break;
			cursor = addDays(cursor, 1);
		}
		for (const session of effectiveSessions) {
			if (!session.outcomeAt) continue;
			const dayKey = timestampToDayKey(
				session.outcomeAt,
				args.timezoneOffsetMinutes,
			);
			const point = activityByDay.get(dayKey);
			if (!point) continue;
			if (getSessionStatus(session) === "completed") {
				point.completedSessions += 1;
			}
			point.activeStudySeconds += session.activeStudySeconds ?? 0;
		}

		const planProgress = plans.map((plan, index) => {
			const planSessions = sessionsByPlan[index].filter(
				(session) => getSessionStatus(session) !== "adjusted",
			);
			const planCompletedSessions = planSessions.filter(
				(session) => getSessionStatus(session) === "completed",
			).length;
			return {
				id: plan._id,
				subject: plan.subject,
				examTypeLabel: plan.examTypeLabel,
				examDateKey: plan.examDateKey,
				examDateLabel: plan.examDateLabel,
				progressPercent:
					planSessions.length > 0
						? Math.round((planCompletedSessions / planSessions.length) * 100)
						: 0,
				completedSessions: planCompletedSessions,
				totalSessions: planSessions.length,
			};
		});
		planProgress.sort((left, right) =>
			left.examDateKey.localeCompare(right.examDateKey),
		);

		const openSessions = effectiveSessions
			.filter((session) => getSessionStatus(session) !== "completed")
			.filter((session) => planById.has(session.learningPlanId))
			.sort((left, right) =>
				`${left.dateKey}-${left.startTime}`.localeCompare(
					`${right.dateKey}-${right.startTime}`,
				),
			);
		const nextSession =
			openSessions.find((session) => session.dateKey >= args.todayKey) ??
			openSessions.at(-1) ??
			null;
		const nextSessionPlan = nextSession
			? planById.get(nextSession.learningPlanId)
			: null;

		const attempts = await ctx.db
			.query("learningSessionAnswerAttempts")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.order("desc")
			.take(MAX_ATTEMPTS);
		const latestAttemptsByItem = new Map<
			Id<"learningSessionContentItems">,
			Doc<"learningSessionAnswerAttempts">
		>();
		for (const attempt of attempts) {
			if (
				!planById.has(attempt.learningPlanId) ||
				!isWithinPeriod(
					attempt.createdAt,
					periodStartDayKey,
					args.todayKey,
					args.timezoneOffsetMinutes,
				) ||
				latestAttemptsByItem.has(attempt.itemId)
			) {
				continue;
			}
			latestAttemptsByItem.set(attempt.itemId, attempt);
		}
		const latestAttempts = [...latestAttemptsByItem.values()];
		const correct = latestAttempts.filter(
			(attempt) => attempt.rating === "correct",
		).length;
		const partiallyCorrect = latestAttempts.filter(
			(attempt) => attempt.rating === "partiallyCorrect",
		).length;
		const notCorrect = latestAttempts.filter(
			(attempt) => attempt.rating === "notCorrect",
		).length;

		const analyses = await ctx.db
			.query("learningSessionAnalyses")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.order("desc")
			.take(MAX_ANALYSES);
		const periodAnalyses = analyses
			.filter(
				(analysis) =>
					planById.has(analysis.learningPlanId) &&
					isWithinPeriod(
						analysis.updatedAt,
						periodStartDayKey,
						args.todayKey,
						args.timezoneOffsetMinutes,
					),
			)
			.sort((left, right) => right.updatedAt - left.updatedAt);

		const totalSessions = effectiveSessions.length;
		const completedSessionCount = completedSessions.length;
		const finishedPlans = planProgress.filter(
			(plan) => plan.totalSessions > 0 && plan.progressPercent === 100,
		).length;
		const recoveredSessions = periodCompletedSessions.filter(
			(session) => session.adjustedFromSessionId !== undefined,
		).length;
		const activeStudySeconds = periodSessions.reduce(
			(total, session) => total + (session.activeStudySeconds ?? 0),
			0,
		);
		const answeredItems = latestAttempts.length;

		return {
			hasData: plans.length > 0,
			historyLimited:
				plans.length === MAX_PLANS ||
				sessionsByPlan.some(
					(planSessions) => planSessions.length === MAX_SESSIONS_PER_PLAN,
				) ||
				attempts.length === MAX_ATTEMPTS ||
				analyses.length === MAX_ANALYSES,
			overall: {
				acceptedPlans: plans.length,
				finishedPlans,
				completedSessions: completedSessionCount,
				totalSessions,
				progressPercent:
					totalSessions > 0
						? Math.round((completedSessionCount / totalSessions) * 100)
						: 0,
			},
			period: {
				completedSessions: periodCompletedSessions.length,
				activeStudyMinutes: Math.round(activeStudySeconds / 60),
				recoveredSessions,
			},
			currentStreakDays: getCurrentStreak(completedDayKeys, args.todayKey),
			activity: [...activityByDay.entries()].map(([dayKey, point]) => ({
				dayKey,
				completedSessions: point.completedSessions,
				activeStudyMinutes: Math.round(point.activeStudySeconds / 60),
			})),
			plans: planProgress,
			nextSession:
				nextSession && nextSessionPlan
					? {
							id: nextSession._id,
							learningPlanId: nextSession.learningPlanId,
							subject: nextSessionPlan.subject,
							title: nextSession.title,
							dateKey: nextSession.dateKey,
						}
					: null,
			knowledge: {
				answeredItems,
				correct,
				partiallyCorrect,
				notCorrect,
				scorePercent:
					answeredItems > 0
						? Math.round(
								((correct + partiallyCorrect * 0.5) / answeredItems) * 100,
							)
						: null,
				strengths: uniqueRecentStrings(
					periodAnalyses.flatMap((analysis) => analysis.strengths),
					3,
				),
				gaps: uniqueRecentStrings(
					periodAnalyses.flatMap((analysis) => analysis.gaps),
					3,
				),
				recommendation: periodAnalyses[0]?.recommendation.trim() || null,
			},
		};
	},
});
