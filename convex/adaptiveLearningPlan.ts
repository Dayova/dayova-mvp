import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
	type AdaptiveLearningTarget,
	type AdaptiveTargetHistory,
	type AdaptiveTopicEvidence,
	adaptiveSessionCopy,
	selectNextAdaptiveLearningTarget,
} from "./adaptiveLearningPlanPolicy";
import { deleteSessionLearningDataForSession } from "./learningSessionContent";
import { normalizeLearningTopics } from "./learningTopicMap";
import { getScheduleConflictMessage } from "./scheduleConflicts";

const MAX_LEARNING_TIMES = 50;

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

const loadAdaptiveEvidence = async (
	ctx: MutationCtx,
	sessions: Doc<"learningPlanSessions">[],
) => {
	const evidence: AdaptiveTopicEvidence[] = [];
	const history: AdaptiveTargetHistory[] = [];
	for (const session of sessions) {
		if (session.targetEvidenceDimension && session.targetTopicIds?.[0]) {
			history.push({
				topicId: session.targetTopicIds[0],
				dimension: session.targetEvidenceDimension,
				targetedAt: session.outcomeAt ?? session.createdAt,
			});
		}
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
		const seenItemIds = new Set<Id<"learningSessionContentItems">>();
		for (const attempt of attempts) {
			if (seenItemIds.has(attempt.itemId)) continue;
			seenItemIds.add(attempt.itemId);
			const item = itemById.get(attempt.itemId);
			const topicId = item?.topicId ?? session.targetTopicIds?.[0];
			if (!item || !topicId || item.kind === "learnCard") continue;
			evidence.push({
				topicId,
				dimension: getAdaptiveEvidenceDimension(item),
				rating: attempt.rating,
				sessionId: session._id,
				createdAt: attempt.createdAt,
			});
		}
	}
	return { evidence, history };
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
	const today = startOfUtcDay(new Date());
	const cursor = Number.isNaN(afterDate.getTime()) ? today : afterDate;
	if (cursor < today) cursor.setTime(today.getTime());
	cursor.setUTCDate(cursor.getUTCDate() + 1);
	const examDate = new Date(`${args.plan.examDateKey.slice(0, 10)}T12:00:00Z`);
	if (Number.isNaN(examDate.getTime())) return null;

	while (cursor < examDate) {
		const dateKey = cursor.toISOString().slice(0, 10);
		const utcDay = cursor.getUTCDay();
		const dayOfWeek = utcDay === 0 ? 7 : utcDay;
		const windows = learningTimes
			.filter((entry) => entry.dayOfWeek === dayOfWeek)
			.sort((left, right) => left.startTime.localeCompare(right.startTime));
		const candidates =
			windows.length > 0
				? windows.flatMap((window) => {
						const start = parseTimeMinutes(window.startTime);
						const end = parseTimeMinutes(window.endTime);
						if (start === null || end === null || end - start < 10) return [];
						return [
							{
								startTime: formatTimeMinutes(start),
								durationMinutes: Math.min(args.durationMinutes, end - start),
							},
						];
					})
				: [
						{
							startTime: args.afterSession.startTime,
							durationMinutes: args.durationMinutes,
						},
					];

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
	if (!targetMatches) {
		await deleteSessionLearningDataForSession(ctx, args.session._id);
	}
	const copy = adaptiveSessionCopy(args.target);
	await ctx.db.patch("learningPlanSessions", args.session._id, {
		...copy,
		phase: args.target.phase,
		compositionVariant: args.target.phase === "theory" ? "split" : "control",
		knowledgeValidationStatus:
			args.target.phase === "theory" ? "pending" : undefined,
		knowledgeValidationConfidence: undefined,
		planningStatus: args.planningStatus,
		targetTopicIds: [args.target.topicId],
		targetEvidenceDimension: args.target.dimension,
		selectionReason: args.target.reason,
		adaptationRevision: args.adaptationRevision,
		...(!targetMatches
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
	const { evidence, history } = await loadAdaptiveEvidence(ctx, sessions);
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
	const committedTarget = selectNextAdaptiveLearningTarget({
		topics,
		initialReadiness: plan.topicReadiness ?? [],
		evidence,
		history,
	});
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
		const todayKey = new Date().toISOString().slice(0, 10);
		const scheduleConflict = await getScheduleConflictMessage(ctx, {
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
			dayKey: provisional.dateKey,
			time: provisional.startTime,
			durationMinutes: provisional.durationMinutes,
			excludeDayEntryId: provisional.dayEntryId,
			excludeLearningPlanSessionId: provisional._id,
		});
		if (provisional.dateKey.slice(0, 10) <= todayKey || scheduleConflict) {
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
	const previewTarget = selectNextAdaptiveLearningTarget({
		topics,
		initialReadiness: plan.topicReadiness ?? [],
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
		history,
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
		contentGenerationStage: "ready",
		updatedAt: Date.now(),
	});
	return {
		committedSessionId: committed._id,
		provisionalSessionId,
	};
};
