import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import {
	type AdaptiveTopicEvidence,
	deriveAdaptiveDimensionStatus,
} from "./adaptiveLearningPlanPolicy";
import { throwUserFacingError } from "./errors";
import type { LearningEvidenceDimension } from "./learningContentPlan";

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

const examPlanOptionValidator = v.object({
	id: v.id("learningPlans"),
	subject: v.string(),
	examTypeLabel: v.string(),
	examDateKey: v.string(),
	examDateLabel: v.string(),
});

const examTopicStatusValidator = v.union(
	v.literal("secure"),
	v.literal("developing"),
	v.literal("uncertain"),
	v.literal("unknown"),
);

const examEvidenceDimensionValidator = v.union(
	v.literal("understanding"),
	v.literal("problemSolving"),
	v.literal("independent"),
);

const topicEvidenceDimensionValidator = v.object({
	kind: examEvidenceDimensionValidator,
	required: v.boolean(),
	status: examTopicStatusValidator,
	evidenceCount: v.number(),
});

const topicEvidenceStatementValidator = v.object({
	statement: v.string(),
	evidenceCount: v.number(),
});

const topicQuestionEvidenceValidator = v.object({
	itemId: v.id("learningSessionContentItems"),
	sessionId: v.id("learningPlanSessions"),
	sessionTitle: v.string(),
	phase: v.union(
		v.literal("theory"),
		v.literal("practice"),
		v.literal("rehearsal"),
	),
	kind: v.union(v.literal("multipleChoice"), v.literal("written")),
	prompt: v.string(),
	answer: v.string(),
	review: v.string(),
	idealAnswer: v.string(),
	rating: v.union(
		v.literal("notCorrect"),
		v.literal("partiallyCorrect"),
		v.literal("correct"),
	),
	evidenceDimension: v.union(examEvidenceDimensionValidator, v.null()),
	answeredAt: v.number(),
});

const examDiagnosisTypeValidator = v.union(
	v.literal("knowledgeGap"),
	v.literal("misconception"),
	v.literal("applicationError"),
	v.literal("unclear"),
);

const examProblemValidator = v.object({
	id: v.string(),
	diagnosisType: examDiagnosisTypeValidator,
	title: v.string(),
	observation: v.string(),
	location: v.string(),
	explanation: v.string(),
	evidenceExcerpt: v.union(v.string(), v.null()),
	correctAnswer: v.string(),
	priorityReason: v.string(),
	diagnosisConfidence: v.string(),
	evidenceCount: v.number(),
	evidenceLabel: v.string(),
	topicId: v.union(v.string(), v.null()),
});

const examAnalysisValidator = v.object({
	hasData: v.boolean(),
	preliminary: v.boolean(),
	plans: v.array(examPlanOptionValidator),
	selectedPlan: v.union(
		v.object({
			...examPlanOptionValidator.fields,
			daysRemaining: v.number(),
		}),
		v.null(),
	),
	readiness: v.object({
		secure: v.number(),
		developing: v.number(),
		uncertain: v.number(),
		unknown: v.number(),
	}),
	abilities: v.array(
		v.object({
			statement: v.string(),
			evidenceCount: v.number(),
			topicId: v.union(v.string(), v.null()),
		}),
	),
	improvements: v.array(
		v.object({
			statement: v.string(),
			evidenceCount: v.number(),
			topicId: v.union(v.string(), v.null()),
		}),
	),
	latestKnowledgeChange: v.union(v.string(), v.null()),
	reviewedNotVerified: v.boolean(),
	primaryProblem: v.union(examProblemValidator, v.null()),
	secondaryProblems: v.array(examProblemValidator),
	topics: v.array(
		v.object({
			id: v.string(),
			title: v.string(),
			learningGoal: v.string(),
			priority: v.union(
				v.literal("high"),
				v.literal("medium"),
				v.literal("low"),
			),
			status: examTopicStatusValidator,
			summary: v.string(),
			evidenceCount: v.number(),
			answeredQuestionCount: v.number(),
			dimensions: v.array(topicEvidenceDimensionValidator),
			strengths: v.array(topicEvidenceStatementValidator),
			weaknesses: v.array(topicEvidenceStatementValidator),
			controlCheckReason: v.union(v.string(), v.null()),
		}),
	),
	recommendation: v.union(
		v.object({
			sessionId: v.id("learningPlanSessions"),
			title: v.string(),
			goal: v.string(),
			methods: v.array(v.string()),
			durationMinutes: v.number(),
			verification: v.string(),
			reason: v.union(v.string(), v.null()),
		}),
		v.null(),
	),
	preparation: v.object({
		remainingDays: v.number(),
		remainingSessions: v.number(),
		remainingMinutes: v.number(),
		nextSession: v.union(
			v.object({
				id: v.id("learningPlanSessions"),
				dateKey: v.string(),
				dateLabel: v.string(),
				startTime: v.string(),
				durationMinutes: v.number(),
			}),
			v.null(),
		),
	}),
	updatedAt: v.union(v.number(), v.null()),
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
const MAX_CONTENT_ITEMS_PER_SESSION = 100;
const MAX_ATTEMPTS = 5_000;
const MAX_ANALYSES = 500;
const MAX_ATTEMPTS_PER_SESSION = 500;
const MAX_TOPIC_QUESTION_EVIDENCE = 500;

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

const isConcreteAbilityStatement = (statement: string) =>
	!/(erste Ansätze|erste Schritte|erste Orientierung|weißt, wo du ansetzen|dich mit .+ beschäftigt)/i.test(
		statement,
	);

const differenceInCalendarDays = (fromDayKey: string, toDayKey: string) => {
	const from = parseDayKey(fromDayKey);
	const to = parseDayKey(toDayKey);
	if (from === null || to === null) return 0;
	return Math.round((to - from) / 86_400_000);
};

const getAttemptExcerpt = (
	attempt: Doc<"learningSessionAnswerAttempts">,
	item: Doc<"learningSessionContentItems">,
) => {
	const written = attempt.answerText?.trim() || attempt.transcript?.trim();
	if (written) return written;
	if (attempt.selectedChoiceId) {
		return (
			item.choices?.find((choice) => choice.id === attempt.selectedChoiceId)
				?.text ?? null
		);
	}
	return null;
};

const getDiagnosisType = ({
	attempt,
	item,
	observation,
}: {
	attempt: Doc<"learningSessionAnswerAttempts">;
	item: Doc<"learningSessionContentItems">;
	observation: string;
}): "knowledgeGap" | "misconception" | "applicationError" | "unclear" => {
	if (item.kind === "multipleChoice") return "unclear";
	if (/missverständ|verwechsel|falsch verstanden/i.test(observation)) {
		return "misconception";
	}
	if (attempt.rating === "partiallyCorrect") return "applicationError";
	const excerpt = getAttemptExcerpt(attempt, item);
	if (!excerpt || excerpt.trim().length < 8) return "knowledgeGap";
	return "unclear";
};

const getEvidenceLabel = (count: number) =>
	count <= 1 ? "Einmal beobachtet" : `In ${count} Antworten erkannt`;

const getMissingEvaluationKeywords = (
	attempt: Doc<"learningSessionAnswerAttempts">,
	item: Doc<"learningSessionContentItems">,
) => {
	const excerpt = getAttemptExcerpt(attempt, item)?.toLocaleLowerCase("de-DE");
	if (!excerpt) return [];
	return item.evaluationKeywords
		.map((keyword) => keyword.trim())
		.filter(
			(keyword) =>
				keyword && !excerpt.includes(keyword.toLocaleLowerCase("de-DE")),
		)
		.slice(0, 3);
};

const getExactIssue = (
	attempt: Doc<"learningSessionAnswerAttempts">,
	item: Doc<"learningSessionContentItems">,
) => {
	const feedback = attempt.feedback.trim();
	if (
		feedback &&
		!/^Noch nicht korrekt\. Schau dir die perfekte Antwort/i.test(feedback) &&
		!/^Teilweise richtig\. Du triffst einen Teil/i.test(feedback)
	) {
		return feedback;
	}

	const missingKeywords = getMissingEvaluationKeywords(attempt, item);
	if (missingKeywords.length > 0) {
		return missingKeywords.length === 1
			? `In deiner Antwort fehlt noch „${missingKeywords[0]}“.`
			: `In deiner Antwort fehlen noch ${missingKeywords.map((keyword) => `„${keyword}“`).join(", ")}.`;
	}
	return null;
};

type TopicEvidenceStatus = "secure" | "developing" | "uncertain" | "unknown";
type InitialTopicEvidenceStatus = Exclude<TopicEvidenceStatus, "uncertain">;

const evidenceDimensions: LearningEvidenceDimension[] = [
	"understanding",
	"problemSolving",
	"independent",
];

const getItemEvidenceDimension = (
	item: Doc<"learningSessionContentItems">,
): LearningEvidenceDimension => {
	if (item.phase === "rehearsal" || item.questionAngle === "examTransfer") {
		return "independent";
	}
	if (["recall", "recognize"].includes(item.questionAngle ?? "")) {
		return "understanding";
	}
	if (
		["apply", "findError", "compare"].includes(item.questionAngle ?? "") ||
		item.phase === "practice"
	) {
		return "problemSolving";
	}
	return "understanding";
};
const deriveDimensionEvidence = ({
	dimension,
	initialStatus,
	itemById,
	required,
	reviewed,
	topicAttempts,
}: {
	dimension: LearningEvidenceDimension;
	initialStatus: InitialTopicEvidenceStatus;
	itemById: Map<
		Id<"learningSessionContentItems">,
		Doc<"learningSessionContentItems">
	>;
	required: boolean;
	reviewed: boolean;
	topicAttempts: Doc<"learningSessionAnswerAttempts">[];
}) => {
	const evidence = topicAttempts.flatMap((attempt) => {
		const item = itemById.get(attempt.itemId);
		return item
			? [
					{
						topicId: item.topicId ?? "",
						dimension: getItemEvidenceDimension(item),
						rating: attempt.rating,
						sessionId: attempt.sessionId,
						createdAt: attempt.createdAt,
					} satisfies AdaptiveTopicEvidence,
				]
			: [];
	});
	const dimensionStatus = deriveAdaptiveDimensionStatus({
		dimension,
		initialStatus,
		evidence,
	});
	const relevantAttempts = topicAttempts
		.filter((attempt) => {
			const item = itemById.get(attempt.itemId);
			return Boolean(item && getItemEvidenceDimension(item) === dimension);
		})
		.sort((left, right) => right.createdAt - left.createdAt);
	const latestShowsDifficulty = Boolean(
		relevantAttempts[0] && relevantAttempts[0].rating !== "correct",
	);
	const status: TopicEvidenceStatus = !required
		? "unknown"
		: dimensionStatus.status === "secure"
			? "secure"
			: latestShowsDifficulty && !dimensionStatus.needsControlCheck
				? "uncertain"
				: dimensionStatus.evidenceCount > 0 ||
						(dimension === "understanding" && reviewed)
					? "developing"
					: "unknown";

	return {
		kind: dimension,
		required,
		status,
		evidenceCount: dimensionStatus.evidenceCount,
		needsControlCheck: required && dimensionStatus.needsControlCheck,
	};
};

const topicPriorityRank = { high: 0, medium: 1, low: 2 } as const;
const topicStatusRiskRank: Record<TopicEvidenceStatus, number> = {
	uncertain: 0,
	developing: 1,
	unknown: 2,
	secure: 3,
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

export const getTopicQuestionEvidence = query({
	args: {
		learningPlanId: v.id("learningPlans"),
		topicId: v.string(),
	},
	returns: v.object({
		historyLimited: v.boolean(),
		questions: v.array(topicQuestionEvidenceValidator),
	}),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (
			!plan ||
			plan.ownerTokenIdentifier !== identity.tokenIdentifier ||
			plan.status !== "accepted"
		) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		const topicExists =
			args.topicId === "exam-scope" ||
			Boolean(plan.topicMap?.some((topic) => topic.id === args.topicId));
		if (!topicExists) throwUserFacingError("Prüfungsthema nicht gefunden.");

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", plan._id),
			)
			.order("asc")
			.take(MAX_SESSIONS_PER_PLAN);
		const completedSessions = sessions.filter(
			(session) => getSessionStatus(session) === "completed",
		);
		const questionGroups = await Promise.all(
			completedSessions.map(async (session) => {
				const items = await ctx.db
					.query("learningSessionContentItems")
					.withIndex("by_sessionId_and_sortOrder", (q) =>
						q.eq("sessionId", session._id),
					)
					.order("asc")
					.take(MAX_CONTENT_ITEMS_PER_SESSION);
				const topicItems = items.filter(
					(item) =>
						item.kind !== "learnCard" &&
						(item.topicId ?? "exam-scope") === args.topicId,
				);
				if (topicItems.length === 0) return [];
				const attempts = await ctx.db
					.query("learningSessionAnswerAttempts")
					.withIndex("by_sessionId_and_createdAt", (q) =>
						q.eq("sessionId", session._id),
					)
					.order("desc")
					.take(MAX_ATTEMPTS_PER_SESSION);
				const latestAttemptByItem = new Map<
					Id<"learningSessionContentItems">,
					Doc<"learningSessionAnswerAttempts">
				>();
				for (const attempt of attempts) {
					if (!latestAttemptByItem.has(attempt.itemId)) {
						latestAttemptByItem.set(attempt.itemId, attempt);
					}
				}

				return topicItems.flatMap((item) => {
					const attempt = latestAttemptByItem.get(item._id);
					if (!attempt) return [];
					const selectedChoice = item.choices?.find(
						(choice) => choice.id === attempt.selectedChoiceId,
					)?.text;
					const answer =
						attempt.answerText?.trim() ||
						attempt.transcript?.trim() ||
						selectedChoice ||
						(attempt.selectedChoiceId === "unknown"
							? "Weiß ich nicht"
							: "Keine Antwort gespeichert");
					return [
						{
							itemId: item._id,
							sessionId: session._id,
							sessionTitle: session.title,
							phase: item.phase,
							kind:
								item.kind === "multipleChoice"
									? ("multipleChoice" as const)
									: ("written" as const),
							prompt: item.prompt,
							answer,
							review: attempt.feedback,
							idealAnswer: attempt.perfectAnswer,
							rating: attempt.rating,
							evidenceDimension: item.evidenceDimension ?? null,
							answeredAt: attempt.createdAt,
						},
					];
				});
			}),
		);
		const questions = questionGroups
			.flat()
			.sort((left, right) => right.answeredAt - left.answeredAt);

		return {
			historyLimited: questions.length > MAX_TOPIC_QUESTION_EVIDENCE,
			questions: questions.slice(0, MAX_TOPIC_QUESTION_EVIDENCE),
		};
	},
});

export const getExamAnalysis = query({
	args: {
		learningPlanId: v.optional(v.id("learningPlans")),
		todayKey: v.string(),
	},
	returns: examAnalysisValidator,
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throwUserFacingError("Nicht authentifiziert.");
		}
		if (parseDayKey(args.todayKey) === null) {
			throwUserFacingError("Ungültiger Kalendertag.");
		}

		const ownerTokenIdentifier = identity.tokenIdentifier;
		const acceptedPlans = await ctx.db
			.query("learningPlans")
			.withIndex("by_ownerTokenIdentifier_and_status", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("status", "accepted"),
			)
			.order("desc")
			.take(MAX_PLANS);
		const plans = [...acceptedPlans].sort((left, right) =>
			left.examDateKey.localeCompare(right.examDateKey),
		);
		const planOptions = plans.map((plan) => ({
			id: plan._id,
			subject: plan.subject,
			examTypeLabel: plan.examTypeLabel,
			examDateKey: plan.examDateKey,
			examDateLabel: plan.examDateLabel,
		}));

		let selectedPlan: Doc<"learningPlans"> | null = null;
		if (args.learningPlanId) {
			selectedPlan =
				plans.find((plan) => plan._id === args.learningPlanId) ?? null;
			if (!selectedPlan) {
				throwUserFacingError("Lernplan nicht gefunden.");
			}
		} else {
			selectedPlan =
				plans.find((plan) => plan.examDateKey >= args.todayKey) ??
				plans.at(-1) ??
				null;
		}

		if (!selectedPlan) {
			return {
				hasData: false,
				preliminary: true,
				plans: planOptions,
				selectedPlan: null,
				readiness: { secure: 0, developing: 0, uncertain: 0, unknown: 0 },
				abilities: [],
				improvements: [],
				latestKnowledgeChange: null,
				reviewedNotVerified: false,
				primaryProblem: null,
				secondaryProblems: [],
				topics: [],
				recommendation: null,
				preparation: {
					remainingDays: 0,
					remainingSessions: 0,
					remainingMinutes: 0,
					nextSession: null,
				},
				updatedAt: null,
			};
		}

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", selectedPlan._id),
			)
			.order("asc")
			.take(MAX_SESSIONS_PER_PLAN);
		const effectiveSessions = sessions.filter(
			(session) => getSessionStatus(session) !== "adjusted",
		);
		const completedSessionIds = new Set(
			effectiveSessions
				.filter((session) => getSessionStatus(session) === "completed")
				.map((session) => session._id),
		);
		const items = (
			await Promise.all(
				sessions.map((session) =>
					ctx.db
						.query("learningSessionContentItems")
						.withIndex("by_sessionId_and_sortOrder", (q) =>
							q.eq("sessionId", session._id),
						)
						.order("asc")
						.take(MAX_CONTENT_ITEMS_PER_SESSION),
				),
			)
		).flat();
		const itemById = new Map(items.map((item) => [item._id, item]));

		const allAttempts = (
			await ctx.db
				.query("learningSessionAnswerAttempts")
				.withIndex("by_ownerTokenIdentifier", (q) =>
					q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
				)
				.order("desc")
				.take(MAX_ATTEMPTS)
		).filter(
			(attempt) =>
				attempt.learningPlanId === selectedPlan._id &&
				completedSessionIds.has(attempt.sessionId),
		);
		const latestAttemptByItem = new Map<
			Id<"learningSessionContentItems">,
			Doc<"learningSessionAnswerAttempts">
		>();
		for (const attempt of allAttempts) {
			if (!latestAttemptByItem.has(attempt.itemId)) {
				latestAttemptByItem.set(attempt.itemId, attempt);
			}
		}
		const latestAttempts = [...latestAttemptByItem.values()];

		const analyses = (
			await ctx.db
				.query("learningSessionAnalyses")
				.withIndex("by_ownerTokenIdentifier", (q) =>
					q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
				)
				.order("desc")
				.take(MAX_ANALYSES)
		)
			.filter(
				(analysis) =>
					analysis.learningPlanId === selectedPlan._id &&
					completedSessionIds.has(analysis.sessionId),
			)
			.sort((left, right) => right.updatedAt - left.updatedAt);
		const latestAnalysis = analyses[0] ?? null;

		const sourceTopics =
			selectedPlan.topicMap && selectedPlan.topicMap.length > 0
				? selectedPlan.topicMap
				: [
						{
							id: "exam-scope",
							title: selectedPlan.topicDescription,
							learningGoal: selectedPlan.topicDescription,
							keywords: [],
							priority: "high" as const,
						},
					];
		const initialReadiness = new Map(
			(selectedPlan.topicReadiness ?? []).map((entry) => [
				entry.topicId,
				entry.status,
			]),
		);
		const completedTheorySessionIds = new Set(
			effectiveSessions
				.filter(
					(session) =>
						session.phase === "theory" &&
						getSessionStatus(session) === "completed",
				)
				.map((session) => session._id),
		);
		const reviewedTopicIds = new Set(
			items
				.filter(
					(item) =>
						item.kind === "learnCard" &&
						Boolean(item.topicId) &&
						completedTheorySessionIds.has(item.sessionId),
				)
				.flatMap((item) => (item.topicId ? [item.topicId] : [])),
		);
		const topicEvidenceProfiles = sourceTopics.map((topic) => {
			const topicAttempts = latestAttempts.filter((attempt) => {
				const item = itemById.get(attempt.itemId);
				return item?.topicId === topic.id && item.kind !== "learnCard";
			});
			const initialStatus = (initialReadiness.get(topic.id) ??
				"unknown") as InitialTopicEvidenceStatus;
			const requiredDimensions = new Set(
				topic.requiredEvidenceDimensions?.length
					? topic.requiredEvidenceDimensions
					: evidenceDimensions,
			);
			const dimensions = evidenceDimensions.map((dimension) =>
				deriveDimensionEvidence({
					dimension,
					initialStatus,
					itemById,
					required: requiredDimensions.has(dimension),
					reviewed: reviewedTopicIds.has(topic.id),
					topicAttempts,
				}),
			);
			const requiredEvidence = dimensions.filter(
				(dimension) => dimension.required,
			);
			const status: TopicEvidenceStatus = requiredEvidence.every(
				(dimension) => dimension.status === "secure",
			)
				? "secure"
				: requiredEvidence.every((dimension) => dimension.status === "unknown")
					? "unknown"
					: requiredEvidence.some(
								(dimension) => dimension.status === "uncertain",
							)
						? "uncertain"
						: "developing";
			const controlDimension = dimensions.find(
				(dimension) => dimension.needsControlCheck,
			);
			const controlCheckReason = controlDimension
				? controlDimension.kind === "understanding"
					? "Eine neue Antwort widerspricht früheren Belegen zum Verständnis."
					: controlDimension.kind === "problemSolving"
						? "Ein neuer Fehler widerspricht früheren Belegen beim Problemlösen."
						: "Eine neue Prüfungsaufgabe widerspricht früheren sicheren Lösungen."
				: null;
			return {
				...topic,
				status,
				dimensions,
				evidenceCount:
					topicAttempts.length + (initialStatus !== "unknown" ? 1 : 0),
				answeredQuestionCount: topicAttempts.length,
				controlCheckReason,
				topicAttempts,
			};
		});

		const strengthStatements = uniqueRecentStrings(
			analyses.flatMap((analysis) => analysis.strengths),
			4,
		).filter(isConcreteAbilityStatement);
		if (strengthStatements.length === 0) {
			strengthStatements.push(
				...uniqueRecentStrings(selectedPlan.insight?.strengths ?? [], 4).filter(
					isConcreteAbilityStatement,
				),
			);
		}
		const abilities = strengthStatements.map((statement) => {
			const matchingSessionIds = new Set(
				analyses
					.filter((analysis) =>
						analysis.strengths.some(
							(strength) =>
								strength.trim().toLocaleLowerCase("de-DE") ===
								statement.toLocaleLowerCase("de-DE"),
						),
					)
					.map((analysis) => analysis.sessionId),
			);
			const matchingAttempts = latestAttempts.filter((attempt) => {
				const item = itemById.get(attempt.itemId);
				return (
					matchingSessionIds.has(attempt.sessionId) &&
					(attempt.rating === "correct" ||
						attempt.rating === "partiallyCorrect") &&
					(item?.kind === "written" || item?.kind === "voice") &&
					Boolean(getAttemptExcerpt(attempt, item))
				);
			});
			const matchingTopicIds = new Set(
				matchingAttempts.flatMap((attempt) => {
					const topicId = itemById.get(attempt.itemId)?.topicId;
					return topicId ? [topicId] : [];
				}),
			);
			return {
				statement,
				evidenceCount: Math.max(1, matchingAttempts.length),
				topicId:
					matchingTopicIds.size === 1
						? ([...matchingTopicIds][0] ?? null)
						: null,
			};
		});

		const attemptsByItem = new Map<
			Id<"learningSessionContentItems">,
			Doc<"learningSessionAnswerAttempts">[]
		>();
		for (const attempt of [...allAttempts].reverse()) {
			const history = attemptsByItem.get(attempt.itemId) ?? [];
			history.push(attempt);
			attemptsByItem.set(attempt.itemId, history);
		}
		const improvements = [...attemptsByItem.entries()]
			.flatMap(([itemId, history]) => {
				const item = itemById.get(itemId);
				const latest = history.at(-1);
				const previouslyOpen = history
					.slice(0, -1)
					.some((attempt) => attempt.rating !== "correct");
				if (!item || latest?.rating !== "correct" || !previouslyOpen) return [];
				return [
					{
						statement: `${item.title} gelingt dir jetzt sicherer.`,
						evidenceCount: history.length,
						topicId: item.topicId ?? null,
					},
				];
			})
			.slice(0, 3);

		const remainingDays = differenceInCalendarDays(
			args.todayKey,
			selectedPlan.examDateKey,
		);
		const topicById = new Map(sourceTopics.map((topic) => [topic.id, topic]));
		const problemAttempts = latestAttempts.filter((attempt) => {
			const item = itemById.get(attempt.itemId);
			return (
				attempt.rating !== "correct" &&
				Boolean(item) &&
				(item?.kind === "written" || item?.kind === "voice") &&
				Boolean(getAttemptExcerpt(attempt, item))
			);
		});
		const problemCandidates = problemAttempts.map((attempt) => {
			const item = itemById.get(attempt.itemId);
			if (!item) return null;
			const observation = getExactIssue(attempt, item);
			if (!observation) return null;
			const evidenceCount = allAttempts.filter((candidate) => {
				const candidateItem = itemById.get(candidate.itemId);
				return (
					candidate.rating !== "correct" &&
					(candidateItem?.kind === "written" ||
						candidateItem?.kind === "voice") &&
					(candidateItem?.topicId ?? candidate.itemId) ===
						(item.topicId ?? item._id)
				);
			}).length;
			const topic = item.topicId ? topicById.get(item.topicId) : null;
			const relevance =
				topic?.priority === "high"
					? "Hohe Prüfungsrelevanz"
					: topic?.priority === "medium"
						? "Mittlere Prüfungsrelevanz"
						: "Direkt in deiner Prüfungsvorbereitung beobachtet";
			const urgency =
				remainingDays < 0
					? ""
					: remainingDays === 0
						? " · Prüfung heute"
						: remainingDays === 1
							? " · Prüfung morgen"
							: ` · noch ${remainingDays} Tage`;
			return {
				id: `${attempt.itemId}`,
				diagnosisType: getDiagnosisType({ attempt, item, observation }),
				title: item.title,
				observation,
				location: item.prompt,
				explanation: item.explanation,
				evidenceExcerpt: getAttemptExcerpt(attempt, item),
				correctAnswer: attempt.perfectAnswer,
				priorityReason: `${relevance} · ${getEvidenceLabel(evidenceCount).toLocaleLowerCase("de-DE")}${urgency}`,
				diagnosisConfidence:
					evidenceCount > 1
						? "Wiederholt beobachtet – die Diagnose ist gut belegt."
						: "Erste Beobachtung – Dayova prüft dieses Muster weiter.",
				evidenceCount,
				evidenceLabel: getEvidenceLabel(evidenceCount),
				topicId: item.topicId ?? null,
				priorityRank: topic
					? topicPriorityRank[topic.priority]
					: topicPriorityRank.low,
				observedAt: attempt.createdAt,
			};
		});
		const uniqueProblemCandidates = problemCandidates
			.filter((problem): problem is NonNullable<typeof problem> =>
				Boolean(problem),
			)
			.filter(
				(problem, index, values) =>
					values.findIndex(
						(candidate) =>
							(candidate.topicId ?? candidate.id) ===
							(problem.topicId ?? problem.id),
					) === index,
			)
			.sort(
				(left, right) =>
					left.priorityRank - right.priorityRank ||
					right.evidenceCount - left.evidenceCount ||
					right.observedAt - left.observedAt,
			);
		const publicProblems = uniqueProblemCandidates.map(
			({ priorityRank: _priorityRank, observedAt: _observedAt, ...problem }) =>
				problem,
		);
		const observedDifficultyCopy: Record<LearningEvidenceDimension, string> = {
			understanding:
				"Bei einer Verständnisfrage war deine letzte Antwort noch nicht vollständig richtig.",
			problemSolving:
				"Beim Problemlösen war deine letzte Antwort noch nicht vollständig richtig.",
			independent:
				"Beim selbstständigen Lösen war deine letzte Antwort noch nicht vollständig richtig.",
		};
		const topics = topicEvidenceProfiles
			.map((topic) => {
				const topicProblems = publicProblems.filter(
					(problem) => problem.topicId === topic.id,
				);
				const mappedStrengths = abilities
					.filter((ability) => ability.topicId === topic.id)
					.map(({ statement, evidenceCount }) => ({
						statement,
						evidenceCount,
					}));
				const fallbackStrengths = topic.topicAttempts
					.filter((attempt) => attempt.rating === "correct")
					.sort((left, right) => right.createdAt - left.createdAt)
					.flatMap((attempt) => {
						const item = itemById.get(attempt.itemId);
						return item
							? [
									{
										statement: `„${item.title}“ richtig gelöst.`,
										evidenceCount: 1,
									},
								]
							: [];
					})
					.filter(
						(strength, index, values) =>
							values.findIndex(
								(candidate) => candidate.statement === strength.statement,
							) === index,
					);
				const strengths = (
					mappedStrengths.length > 0
						? mappedStrengths
						: topic.status === "secure"
							? [
									{
										statement: topic.learningGoal,
										evidenceCount: topic.evidenceCount,
									},
								]
							: fallbackStrengths
				).slice(0, 2);
				const firstOpenDimension = topic.dimensions.find(
					(dimension) => dimension.required && dimension.status !== "secure",
				);
				const weaknesses =
					topicProblems.length > 0
						? topicProblems.slice(0, 2).map((problem) => ({
								statement: problem.observation,
								evidenceCount: problem.evidenceCount,
							}))
						: topic.status === "uncertain" && firstOpenDimension
							? [
									{
										statement: observedDifficultyCopy[firstOpenDimension.kind],
										evidenceCount: firstOpenDimension.evidenceCount,
									},
								]
							: [];
				const summary = topic.controlCheckReason
					? "Kontrollbeleg nötig"
					: (weaknesses[0]?.statement ??
						(topic.status === "secure"
							? "Alle erforderlichen Wissensbelege vorhanden."
							: topic.status === "developing"
								? "Erste Belege vorhanden, aber noch nicht stabil."
								: "Noch keine überprüften Antworten."));

				return {
					id: topic.id,
					title: topic.title,
					learningGoal: topic.learningGoal,
					priority: topic.priority,
					status: topic.status,
					summary,
					evidenceCount: topic.evidenceCount,
					answeredQuestionCount: topic.answeredQuestionCount,
					dimensions: topic.dimensions.map(
						({ needsControlCheck: _needsControlCheck, ...dimension }) =>
							dimension,
					),
					strengths,
					weaknesses,
					controlCheckReason: topic.controlCheckReason,
				};
			})
			.sort((left, right) => {
				const leftRisk =
					topicPriorityRank[left.priority] * 10 +
					topicStatusRiskRank[left.status];
				const rightRisk =
					topicPriorityRank[right.priority] * 10 +
					topicStatusRiskRank[right.status];
				return (
					leftRisk - rightRisk || left.title.localeCompare(right.title, "de")
				);
			});
		const readiness = topics.reduce(
			(counts, topic) => {
				counts[topic.status] += 1;
				return counts;
			},
			{ secure: 0, developing: 0, uncertain: 0, unknown: 0 },
		);
		const primaryProblem = publicProblems[0] ?? null;
		const secondaryProblems = publicProblems.slice(1, 3);

		const openSessions = effectiveSessions
			.filter((session) => getSessionStatus(session) !== "completed")
			.sort((left, right) =>
				`${left.dateKey}-${left.startTime}`.localeCompare(
					`${right.dateKey}-${right.startTime}`,
				),
			);
		const nextSession =
			openSessions.find((session) => session.dateKey >= args.todayKey) ??
			openSessions.at(-1) ??
			null;
		const deferredValidationSession =
			effectiveSessions
				.filter(
					(session) =>
						session.phase === "theory" &&
						session.compositionVariant === "split" &&
						getSessionStatus(session) === "completed" &&
						session.knowledgeValidationStatus !== "completed",
				)
				.sort(
					(left, right) =>
						(right.outcomeAt ?? right.updatedAt) -
						(left.outcomeAt ?? left.updatedAt),
				)[0] ?? null;
		const latestAttempt = latestAttempts
			.slice()
			.sort((left, right) => right.createdAt - left.createdAt)[0];
		const latestAttemptItem = latestAttempt
			? itemById.get(latestAttempt.itemId)
			: null;
		const latestKnowledgeChange = deferredValidationSession
			? "Theorie abgeschlossen · Wissen noch nicht überprüft."
			: improvements[0]?.statement
				? `Seit deinem letzten Check: ${improvements[0].statement}`
				: latestAttempt && latestAttemptItem
					? latestAttempt.rating === "correct"
						? `Zuletzt gezeigt: ${latestAttemptItem.title} gelingt dir.`
						: `Zuletzt geprüft: ${latestAttemptItem.title} bleibt in Arbeit.`
					: null;
		const remainingMinutes = openSessions.reduce(
			(total, session) => total + session.durationMinutes,
			0,
		);

		return {
			hasData: true,
			preliminary: analyses.length === 0,
			plans: planOptions,
			selectedPlan: {
				id: selectedPlan._id,
				subject: selectedPlan.subject,
				examTypeLabel: selectedPlan.examTypeLabel,
				examDateKey: selectedPlan.examDateKey,
				examDateLabel: selectedPlan.examDateLabel,
				daysRemaining: remainingDays,
			},
			readiness,
			abilities,
			improvements,
			latestKnowledgeChange,
			reviewedNotVerified: Boolean(deferredValidationSession),
			primaryProblem,
			secondaryProblems,
			topics,
			recommendation: deferredValidationSession
				? {
						sessionId: deferredValidationSession._id,
						title: "Wissenscheck",
						goal: "Prüfen, was aus der Theorie wirklich hängen geblieben ist",
						methods: [
							"Eine Antwort frei formulieren",
							"Eine kurze Anwendung lösen",
							"Deine Sicherheit einschätzen",
						],
						durationMinutes: 3,
						verification:
							"Dayova aktualisiert danach deinen Wissensstand mit neuen Belegen.",
						reason: "Theorie abgeschlossen · Wissen noch nicht überprüft.",
					}
				: nextSession
					? {
							sessionId: nextSession._id,
							title: nextSession.title,
							goal: nextSession.goal,
							methods: nextSession.tasks,
							durationMinutes: nextSession.durationMinutes,
							verification: nextSession.expectedOutcome,
							reason: latestAnalysis?.recommendation.trim() || null,
						}
					: null,
			preparation: {
				remainingDays,
				remainingSessions: openSessions.length,
				remainingMinutes,
				nextSession: nextSession
					? {
							id: nextSession._id,
							dateKey: nextSession.dateKey,
							dateLabel: nextSession.dateLabel,
							startTime: nextSession.startTime,
							durationMinutes: nextSession.durationMinutes,
						}
					: null,
			},
			updatedAt: latestAnalysis?.updatedAt ?? selectedPlan.updatedAt,
		};
	},
});
