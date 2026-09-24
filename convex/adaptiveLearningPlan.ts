import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
	type AdaptiveLearningTarget,
	type AdaptiveTargetHistory,
	type AdaptiveTopicEvidence,
	adaptiveSessionCopy,
	selectAdaptiveMaintenanceTarget,
	selectNextAdaptiveLearningTarget,
} from "./adaptiveLearningPlanPolicy";
import { deleteSessionLearningDataForSession } from "./learningSessionContent";
import { normalizeLearningTopics } from "./learningTopicMap";
import { getScheduleConflictMessage } from "./scheduleConflicts";

const MAX_LEARNING_TIMES = 50;
const PAIRED_THEORY_QUESTION_SUFFIX = ":paired-practice";

const isPairedTheoryQuestionItem = (item: Doc<"learningSessionContentItems">) =>
	item.coverageKey?.endsWith(PAIRED_THEORY_QUESTION_SUFFIX) === true;

type RollingPlanCalendar = {
	clearSession: (
		ctx: MutationCtx,
		session: Doc<"learningPlanSessions">,
	) => Promise<void>;
	syncSession: (
		ctx: MutationCtx,
		plan: Doc<"learningPlans">,
		session: Doc<"learningPlanSessions">,
	) => Promise<unknown>;
};

const getSessionExecutionStatus = (session: Doc<"learningPlanSessions">) =>
	session.executionStatus ?? (session.completed ? "completed" : "notStarted");

const getAdaptiveEvidenceDimension = (
	item: Doc<"learningSessionContentItems">,
): AdaptiveTopicEvidence["dimension"] => {
	if (item.evidenceDimension) return item.evidenceDimension;
	if (item.phase === "rehearsal" || item.questionAngle === "examTransfer") {
		return "independent";
	}
	if (
		["apply", "findError", "compare"].includes(item.questionAngle ?? "") ||
		item.phase === "practice"
	) {
		return "problemSolving";
	}
	return "understanding";
};

const getSessionTargetEvidenceDimension = (
	session: Doc<"learningPlanSessions">,
): AdaptiveTopicEvidence["dimension"] =>
	session.targetEvidenceDimension ??
	(session.phase === "theory"
		? "understanding"
		: session.phase === "practice"
			? "problemSolving"
			: "independent");

const loadAdaptiveEvidence = async (
	ctx: MutationCtx,
	sessions: Doc<"learningPlanSessions">[],
) => {
	const evidence: AdaptiveTopicEvidence[] = [];
	const history: AdaptiveTargetHistory[] = [];
	const diagnosticRatingsByTopicId = new Map<
		string,
		Array<AdaptiveTopicEvidence["rating"]>
	>();
	for (const session of sessions) {
		const items = await ctx.db
			.query("learningSessionContentItems")
			.withIndex("by_sessionId_and_sortOrder", (q) =>
				q.eq("sessionId", session._id),
			)
			.take(50);
		const itemById = new Map(items.map((item) => [item._id, item]));
		const attempts = await ctx.db
			.query("learningSessionAnswerAttempts")
			.withIndex("by_sessionId_and_createdAt", (q) =>
				q.eq("sessionId", session._id),
			)
			.order("desc")
			.take(100);
		const executionStatus = getSessionExecutionStatus(session);
		const wasActuallyAttempted =
			attempts.length > 0 ||
			executionStatus === "completed" ||
			executionStatus === "partiallyCompleted";
		if (session.planningStatus !== "provisional" && wasActuallyAttempted) {
			const targetTopicIds =
				session.targetTopicIds && session.targetTopicIds.length > 0
					? session.targetTopicIds
					: Array.from(
							new Set(
								items
									.map((item) => item.topicId)
									.filter((topicId): topicId is string => Boolean(topicId)),
							),
						);
			for (const topicId of targetTopicIds) {
				history.push({
					topicId,
					dimension: getSessionTargetEvidenceDimension(session),
					targetedAt: session.outcomeAt ?? session.createdAt,
				});
			}
		}
		const seenItemIds = new Set<Id<"learningSessionContentItems">>();
		for (const attempt of attempts) {
			if (seenItemIds.has(attempt.itemId)) continue;
			seenItemIds.add(attempt.itemId);
			const item = itemById.get(attempt.itemId);
			const topicId = item?.topicId ?? session.targetTopicIds?.[0];
			if (
				!item ||
				!topicId ||
				item.kind === "learnCard" ||
				isPairedTheoryQuestionItem(item)
			) {
				continue;
			}
			evidence.push({
				topicId,
				dimension: getAdaptiveEvidenceDimension(item),
				rating: attempt.rating,
				sessionId: session._id,
				createdAt: attempt.createdAt,
			});
			if (session.sessionPurpose === "diagnostic") {
				const ratings = diagnosticRatingsByTopicId.get(topicId) ?? [];
				ratings.push(attempt.rating);
				diagnosticRatingsByTopicId.set(topicId, ratings);
			}
		}
	}
	const diagnosticReadiness = Array.from(
		diagnosticRatingsByTopicId.entries(),
	).map(([topicId, ratings]) => ({
		topicId,
		status: ratings.every((rating) => rating === "correct")
			? ("secure" as const)
			: ("developing" as const),
	}));
	return { evidence, history, diagnosticReadiness };
};

const parseTimeMinutes = (value: string) => {
	const match = /^(\d{2}):(\d{2})$/.exec(value);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
		? hours * 60 + minutes
		: null;
};

const formatTimeMinutes = (value: number) =>
	`${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

const getBerlinDateTime = (date: Date) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Berlin",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;
	const year = valueFor("year");
	const month = valueFor("month");
	const day = valueFor("day");
	const hour = Number(valueFor("hour"));
	const minute = Number(valueFor("minute"));
	if (
		!year ||
		!month ||
		!day ||
		!Number.isInteger(hour) ||
		!Number.isInteger(minute)
	) {
		throw new Error("Die aktuelle Zeit konnte nicht bestimmt werden.");
	}
	return {
		dateKey: `${year}-${month}-${day}`,
		minutes: hour * 60 + minute,
	};
};

const startOfUtcDay = (date: Date) => {
	const next = new Date(date);
	next.setUTCHours(0, 0, 0, 0);
	return next;
};

const formatDateLabel = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		timeZone: "Europe/Berlin",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);

const getRollingSessionSchedule = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		plan: Doc<"learningPlans">;
		afterSession: Doc<"learningPlanSessions">;
		durationMinutes: number;
		excludeSession?: Doc<"learningPlanSessions">;
	},
) => {
	const learningTimes = await ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", args.ownerTokenIdentifier),
		)
		.take(MAX_LEARNING_TIMES);
	const afterDate = new Date(
		`${args.afterSession.dateKey.slice(0, 10)}T12:00:00Z`,
	);
	const now = new Date();
	const berlinNow = getBerlinDateTime(now);
	const today = startOfUtcDay(new Date(`${berlinNow.dateKey}T12:00:00Z`));
	const cursor = Number.isNaN(afterDate.getTime()) ? today : afterDate;
	if (cursor < today) cursor.setTime(today.getTime());
	const examDate = new Date(`${args.plan.examDateKey.slice(0, 10)}T12:00:00Z`);
	if (Number.isNaN(examDate.getTime())) return null;
	const afterDateKey = args.afterSession.dateKey.slice(0, 10);
	const afterStartMinutes = parseTimeMinutes(args.afterSession.startTime);
	const afterEndMinutes =
		afterStartMinutes === null
			? null
			: afterStartMinutes + args.afterSession.durationMinutes;

	while (cursor < examDate) {
		const dateKey = cursor.toISOString().slice(0, 10);
		const utcDay = cursor.getUTCDay();
		const dayOfWeek = utcDay === 0 ? 7 : utcDay;
		const windows = learningTimes
			.filter((entry) => entry.dayOfWeek === dayOfWeek)
			.sort((left, right) => left.startTime.localeCompare(right.startTime));
		const earliestStart = Math.max(
			0,
			dateKey === afterDateKey ? (afterEndMinutes ?? 0) : 0,
			dateKey === berlinNow.dateKey ? berlinNow.minutes + 1 : 0,
		);
		const candidates = windows.flatMap((window) => {
			const windowStart = parseTimeMinutes(window.startTime);
			const end = parseTimeMinutes(window.endTime);
			if (windowStart === null || end === null) return [];
			const start = Math.max(windowStart, earliestStart);
			const windowCandidates = [];
			for (
				let candidateStart = start;
				candidateStart + 10 <= end;
				candidateStart += 10
			) {
				windowCandidates.push({
					startTime: formatTimeMinutes(candidateStart),
					durationMinutes: Math.min(args.durationMinutes, end - candidateStart),
				});
			}
			return windowCandidates;
		});

		for (const candidate of candidates) {
			const conflict = await getScheduleConflictMessage(ctx, {
				ownerTokenIdentifier: args.ownerTokenIdentifier,
				dayKey: dateKey,
				time: candidate.startTime,
				durationMinutes: candidate.durationMinutes,
				excludeDayEntryId: args.excludeSession?.dayEntryId,
				excludeLearningPlanSessionId: args.excludeSession?._id,
			});
			if (!conflict) {
				return {
					dateKey,
					dateLabel: formatDateLabel(cursor),
					startTime: candidate.startTime,
					durationMinutes: candidate.durationMinutes,
				};
			}
		}
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return null;
};

const isSessionScheduledInFuture = (
	session: Doc<"learningPlanSessions">,
	now = new Date(),
) => {
	const dateKey = session.dateKey.slice(0, 10);
	const startMinutes = parseTimeMinutes(session.startTime);
	if (startMinutes === null) return false;
	const current = getBerlinDateTime(now);
	return (
		dateKey > current.dateKey ||
		(dateKey === current.dateKey && startMinutes > current.minutes)
	);
};

const removeRollingSession = async (
	ctx: MutationCtx,
	session: Doc<"learningPlanSessions">,
) => {
	await deleteSessionLearningDataForSession(ctx, session._id);
	if (session.dayEntryId) {
		const dayEntry = await ctx.db.get("dayEntries", session.dayEntryId);
		if (dayEntry?.ownerTokenIdentifier === session.ownerTokenIdentifier) {
			await ctx.db.delete("dayEntries", session.dayEntryId);
		}
	}
	await ctx.db.delete("learningPlanSessions", session._id);
};

const patchRollingSessionTarget = async (
	ctx: MutationCtx,
	args: {
		plan: Doc<"learningPlans">;
		session: Doc<"learningPlanSessions">;
		target: AdaptiveLearningTarget;
		planningStatus: "committed" | "provisional";
		adaptationRevision: number;
		calendar: RollingPlanCalendar;
	},
) => {
	const targetMatches =
		args.session.targetTopicIds?.[0] === args.target.topicId &&
		args.session.targetEvidenceDimension === args.target.dimension;
	const isPromotion =
		args.session.planningStatus === "provisional" &&
		args.planningStatus === "committed";
	const shouldRegenerateContent = isPromotion || !targetMatches;
	if (shouldRegenerateContent) {
		await deleteSessionLearningDataForSession(ctx, args.session._id);
	}
	const copy = adaptiveSessionCopy(args.target);
	await ctx.db.patch("learningPlanSessions", args.session._id, {
		...copy,
		phase: args.target.phase,
		compositionVariant: args.target.phase === "theory" ? "split" : "control",
		sessionPurpose: "learning",
		knowledgeValidationStatus:
			args.target.phase === "theory" ? "pending" : undefined,
		knowledgeValidationConfidence: undefined,
		planningStatus: args.planningStatus,
		targetTopicIds: [args.target.topicId],
		targetEvidenceDimension: args.target.dimension,
		selectionReason: args.target.reason,
		adaptationRevision: args.adaptationRevision,
		...(shouldRegenerateContent
			? {
					contentGenerationStatus:
						args.planningStatus === "committed"
							? ("queued" as const)
							: undefined,
					contentGenerationError: undefined,
					contentGenerationStartedAt: undefined,
					contentGeneratedAt: undefined,
				}
			: args.planningStatus === "committed" &&
					args.session.contentGenerationStatus === undefined
				? { contentGenerationStatus: "queued" as const }
				: {}),
		updatedAt: Date.now(),
	});
	const updated = await ctx.db.get("learningPlanSessions", args.session._id);
	if (updated && args.plan.status === "accepted") {
		if (args.planningStatus === "committed") {
			await args.calendar.syncSession(ctx, args.plan, updated);
		} else {
			await args.calendar.clearSession(ctx, updated);
		}
	}
	return updated;
};

export const advanceRollingLearningPlan = async (
	ctx: MutationCtx,
	plan: Doc<"learningPlans">,
	calendar: RollingPlanCalendar,
) => {
	if (!plan.rollingPlanEnabled) return null;
	const sessions = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", plan._id),
		)
		.order("asc")
		.take(50);
	const { evidence, history, diagnosticReadiness } = await loadAdaptiveEvidence(
		ctx,
		sessions,
	);
	const topics =
		plan.topicMap && plan.topicMap.length > 0
			? plan.topicMap
			: normalizeLearningTopics([
					{
						id: "exam-scope",
						title: plan.topicDescription,
						learningGoal: plan.topicDescription,
						keywords: [plan.subject],
						priority: "high" as const,
					},
				]);
	const diagnosticTopicIds = new Set(
		diagnosticReadiness.map((entry) => entry.topicId),
	);
	const effectiveTopicReadiness = [
		...(plan.topicReadiness ?? []).filter(
			(entry) => !diagnosticTopicIds.has(entry.topicId),
		),
		...diagnosticReadiness,
	];
	const committedTarget =
		selectNextAdaptiveLearningTarget({
			topics,
			initialReadiness: effectiveTopicReadiness,
			evidence,
			history,
		}) ?? selectAdaptiveMaintenanceTarget({ topics, history });
	const provisionalSessions = sessions.filter(
		(session) =>
			session.planningStatus === "provisional" &&
			getSessionExecutionStatus(session) === "notStarted",
	);
	let provisional: Doc<"learningPlanSessions"> | null =
		provisionalSessions[0] ?? null;
	for (const duplicate of provisionalSessions.slice(1)) {
		await removeRollingSession(ctx, duplicate);
	}
	const adaptationRevision = (plan.adaptationRevision ?? 0) + 1;
	if (!committedTarget) {
		if (provisional) await removeRollingSession(ctx, provisional);
		await ctx.db.patch("learningPlans", plan._id, {
			adaptationRevision,
			updatedAt: Date.now(),
		});
		return { committedSessionId: null, provisionalSessionId: null };
	}

	let committed: Doc<"learningPlanSessions"> | null = null;
	if (provisional) {
		const scheduleConflict = await getScheduleConflictMessage(ctx, {
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
			dayKey: provisional.dateKey,
			time: provisional.startTime,
			durationMinutes: provisional.durationMinutes,
			excludeDayEntryId: provisional.dayEntryId,
			excludeLearningPlanSessionId: provisional._id,
		});
		if (!isSessionScheduledInFuture(provisional) || scheduleConflict) {
			const previousSession = sessions
				.filter((session) => session._id !== provisional?._id)
				.at(-1);
			const replacementSchedule = previousSession
				? await getRollingSessionSchedule(ctx, {
						ownerTokenIdentifier: plan.ownerTokenIdentifier,
						plan,
						afterSession: previousSession,
						durationMinutes: Math.min(provisional.durationMinutes, 20),
						excludeSession: provisional,
					})
				: null;
			if (!replacementSchedule) {
				await removeRollingSession(ctx, provisional);
				provisional = null;
			} else {
				await ctx.db.patch(
					"learningPlanSessions",
					provisional._id,
					replacementSchedule,
				);
				provisional = await ctx.db.get("learningPlanSessions", provisional._id);
			}
		}
	}
	if (provisional) {
		committed = await patchRollingSessionTarget(ctx, {
			plan,
			session: provisional,
			target: committedTarget,
			planningStatus: "committed",
			adaptationRevision,
			calendar,
		});
	} else {
		const previousSession = sessions.at(-1);
		const schedule = previousSession
			? await getRollingSessionSchedule(ctx, {
					ownerTokenIdentifier: plan.ownerTokenIdentifier,
					plan,
					afterSession: previousSession,
					durationMinutes: Math.min(previousSession.durationMinutes, 20),
				})
			: null;
		if (previousSession && schedule) {
			const copy = adaptiveSessionCopy(committedTarget);
			const committedId = await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: plan.ownerTokenIdentifier,
				learningPlanId: plan._id,
				phase: committedTarget.phase,
				sessionPurpose: "learning",
				...copy,
				...schedule,
				compositionVariant:
					committedTarget.phase === "theory" ? "split" : "control",
				...(committedTarget.phase === "theory"
					? { knowledgeValidationStatus: "pending" as const }
					: {}),
				contentGenerationStatus: "queued",
				planningStatus: "committed",
				targetTopicIds: [committedTarget.topicId],
				targetEvidenceDimension: committedTarget.dimension,
				selectionReason: committedTarget.reason,
				adaptationRevision,
				sortOrder: previousSession.sortOrder + 1,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			committed = await ctx.db.get("learningPlanSessions", committedId);
			if (committed && plan.status === "accepted") {
				await calendar.syncSession(ctx, plan, committed);
			}
		}
	}
	if (!committed) return null;
	const projectedHistory = [
		...history,
		{
			topicId: committedTarget.topicId,
			dimension: committedTarget.dimension,
			targetedAt: Date.now() + 1,
		},
	];
	const previewTarget =
		selectNextAdaptiveLearningTarget({
			topics,
			initialReadiness: effectiveTopicReadiness,
			evidence: [
				...evidence,
				{
					topicId: committedTarget.topicId,
					dimension: committedTarget.dimension,
					rating: "correct",
					sessionId: `projected-${committed._id}`,
					createdAt: Date.now() + 1,
				},
			],
			history: projectedHistory,
		}) ??
		selectAdaptiveMaintenanceTarget({
			topics,
			history: projectedHistory,
		});
	const schedule = previewTarget
		? await getRollingSessionSchedule(ctx, {
				ownerTokenIdentifier: plan.ownerTokenIdentifier,
				plan,
				afterSession: committed,
				durationMinutes: Math.min(committed.durationMinutes, 20),
			})
		: null;
	let provisionalSessionId: Id<"learningPlanSessions"> | null = null;
	if (previewTarget && schedule) {
		const highestSortOrder = Math.max(
			committed.sortOrder,
			...sessions.map((session) => session.sortOrder),
		);
		const copy = adaptiveSessionCopy(previewTarget);
		provisionalSessionId = await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
			learningPlanId: plan._id,
			phase: previewTarget.phase,
			sessionPurpose: "learning",
			...copy,
			...schedule,
			compositionVariant:
				previewTarget.phase === "theory" ? "split" : "control",
			...(previewTarget.phase === "theory"
				? { knowledgeValidationStatus: "pending" as const }
				: {}),
			planningStatus: "provisional",
			targetTopicIds: [previewTarget.topicId],
			targetEvidenceDimension: previewTarget.dimension,
			selectionReason: previewTarget.reason,
			adaptationRevision,
			sortOrder: highestSortOrder + 1,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
	}
	await ctx.db.patch("learningPlans", plan._id, {
		adaptationRevision,
		topicReadiness: effectiveTopicReadiness,
		contentGenerationStage: "ready",
		updatedAt: Date.now(),
	});
	return {
		committedSessionId: committed._id,
		provisionalSessionId,
	};
};
