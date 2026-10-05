import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getBerlinDayKey } from "./dayKeyVariants";
import {
	addPersonalSubjectReference,
	deleteDayEntryWithPersonalSubjectReference,
	replacePersonalSubjectReference,
} from "./personalSubjectReferences";
import { assertNoScheduleConflict, isExamEntry } from "./scheduleConflicts";
import {
	getActiveTimetableLessons,
	getTimetableDayOfWeek,
	getTimetableLessonDuration,
} from "./timetableOccurrences";

const MAX_SCHEDULING_DAY_ENTRIES = 500;
const MAX_SCHEDULING_LOOKAHEAD_DAYS = 366;
const getSessionExecutionStatus = (session: Doc<"learningPlanSessions">) =>
	session.executionStatus ?? (session.completed ? "completed" : "notStarted");
const isCompletedStatus = (
	status: ReturnType<typeof getSessionExecutionStatus>,
) => status === "completed";

export const getAvailabilityDayKeys = (
	fromDateKey: string,
	examDateKey: string,
) => {
	const cursor = new Date(`${fromDateKey}T00:00:00.000Z`);
	const examDate = new Date(`${examDateKey}T00:00:00.000Z`);
	if (Number.isNaN(cursor.getTime()) || Number.isNaN(examDate.getTime())) {
		return [];
	}

	const dayCount = Math.ceil(
		(examDate.getTime() - cursor.getTime()) / 86_400_000,
	);
	// The exam-date selector exposes one year. Fail closed for malformed route
	// params beyond that range instead of starting an unbounded database read.
	if (dayCount > MAX_SCHEDULING_LOOKAHEAD_DAYS) return [];
	if (dayCount <= 0) return [];

	const dayKeys: string[] = [];
	while (cursor < examDate) {
		dayKeys.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return dayKeys;
};

type SchedulingOccupiedEntry = {
	dayKey: string;
	time?: string;
	durationMinutes?: number;
};

export const getSchedulingOccupiedEntries = async (
	ctx: QueryCtx,
	{
		ownerTokenIdentifier,
		dayKeys,
	}: {
		ownerTokenIdentifier: string;
		dayKeys: string[];
	},
) => {
	if (dayKeys.length === 0) {
		return {
			entries: [] as SchedulingOccupiedEntry[],
			wasTruncated: false,
		};
	}

	const requestedDayKeys = new Set(dayKeys);
	const queryStart = new Date(`${dayKeys[0]}T00:00:00.000Z`);
	queryStart.setUTCDate(queryStart.getUTCDate() - 1);
	const queryEnd = new Date(`${dayKeys.at(-1)}T00:00:00.000Z`);
	queryEnd.setUTCDate(queryEnd.getUTCDate() + 1);
	const dayEntries = await ctx.db
		.query("dayEntries")
		.withIndex("by_ownerTokenIdentifier_and_dayKey", (q) =>
			q
				.eq("ownerTokenIdentifier", ownerTokenIdentifier)
				.gte("dayKey", queryStart.toISOString().slice(0, 10))
				.lt("dayKey", queryEnd.toISOString().slice(0, 10)),
		)
		.take(MAX_SCHEDULING_DAY_ENTRIES + 1);
	const wasTruncated = dayEntries.length > MAX_SCHEDULING_DAY_ENTRIES;
	const entries: SchedulingOccupiedEntry[] = dayEntries
		.slice(0, MAX_SCHEDULING_DAY_ENTRIES)
		.flatMap((entry) => {
			const dayKey = getBerlinDayKey(entry.dayKey);
			if (!dayKey || !requestedDayKeys.has(dayKey)) return [];
			return [
				{
					dayKey,
					time: isExamEntry(entry) ? undefined : entry.time,
					durationMinutes: entry.durationMinutes,
				},
			];
		});
	const timetableLessons = await getActiveTimetableLessons(
		ctx,
		ownerTokenIdentifier,
	);
	for (const dayKey of dayKeys) {
		const dayOfWeek = getTimetableDayOfWeek(dayKey);
		for (const lesson of timetableLessons) {
			if (lesson.dayOfWeek !== dayOfWeek) continue;
			entries.push({
				dayKey,
				time: lesson.startTime,
				durationMinutes: getTimetableLessonDuration(lesson) ?? undefined,
			});
		}
	}

	return { entries, wasTruncated };
};

const getSessionDayEntryTitle = (
	plan: Doc<"learningPlans">,
	session: Pick<Doc<"learningPlanSessions">, "title">,
) => `${plan.subject} ${session.title}`;

const getSessionDayEntryNotes = (
	session: Pick<
		Doc<"learningPlanSessions">,
		"goal" | "tasks" | "expectedOutcome"
	>,
) =>
	[
		session.goal,
		...session.tasks.map((task) => `- ${task}`),
		session.expectedOutcome,
	].join("\n");

const createSessionDayEntry = async (
	ctx: MutationCtx,
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => {
	const executionStatus = getSessionExecutionStatus(session);
	const dayEntryId = await ctx.db.insert("dayEntries", {
		ownerTokenIdentifier: session.ownerTokenIdentifier,
		dayKey: session.dateKey,
		title: getSessionDayEntryTitle(plan, session),
		subject: plan.subject,
		...(plan.personalSubjectId
			? { personalSubjectId: plan.personalSubjectId }
			: {}),
		time: session.startTime,
		kind: "Lernen",
		notes: getSessionDayEntryNotes(session),
		plannedDateLabel: session.dateLabel,
		durationMinutes: session.durationMinutes,
		completed: isCompletedStatus(executionStatus),
		executionStatus,
		startedAt: session.startedAt,
		outcomeAt: session.outcomeAt,
		missedReason: session.missedReason,
		adjustedFromSessionId: session.adjustedFromSessionId,
		relatedLearningPlanId: session.learningPlanId,
		relatedLearningPlanSessionId: session._id,
	});
	await addPersonalSubjectReference(ctx, {
		ownerTokenIdentifier: session.ownerTokenIdentifier,
		personalSubjectId: plan.personalSubjectId,
		target: { targetKind: "dayEntry", dayEntryId },
	});
	return dayEntryId;
};

export const syncSessionDayEntry = async (
	ctx: MutationCtx,
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => {
	if (session.unscheduled || session.additionalPractice)
		return session.dayEntryId;
	if (session.preparationSlotId) {
		const group = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_preparationSlotId", (q) =>
				q
					.eq("learningPlanId", plan._id)
					.eq("preparationSlotId", session.preparationSlotId),
			)
			.take(50);
		group.sort((a, b) => a.sortOrder - b.sortOrder);
		const first = group[0];
		if (!first) return;
		const duration = group.reduce((sum, s) => sum + s.durationMinutes, 0);
		const completed = group.every(
			(s) => getSessionExecutionStatus(s) === "completed",
		);
		const started = group.some(
			(s) =>
				getSessionExecutionStatus(s) === "started" ||
				getSessionExecutionStatus(s) === "completed",
		);
		const representative = {
			...first,
			durationMinutes: duration,
			completed,
			executionStatus: completed
				? ("completed" as const)
				: started
					? ("started" as const)
					: ("notStarted" as const),
		};
		let entryId = first.dayEntryId;
		if (!entryId) {
			await assertNoScheduleConflict(ctx, {
				ownerTokenIdentifier: plan.ownerTokenIdentifier,
				dayKey: first.dateKey,
				time: first.startTime,
				durationMinutes: duration,
			});
			entryId = await createSessionDayEntry(ctx, plan, representative);
			for (const member of group)
				await ctx.db.patch("learningPlanSessions", member._id, {
					dayEntryId: entryId,
				});
		} else {
			const next =
				group.find((s) =>
					["notStarted", "started"].includes(getSessionExecutionStatus(s)),
				) ?? first;
			await ctx.db.patch("dayEntries", entryId, {
				completed,
				executionStatus: representative.executionStatus,
				relatedLearningPlanSessionId: next._id,
				title: `${plan.subject} · Lernen`,
				startedAt: started ? Date.now() : undefined,
				outcomeAt: completed ? Date.now() : undefined,
			});
		}
		return entryId;
	}

	await assertNoScheduleConflict(ctx, {
		ownerTokenIdentifier: session.ownerTokenIdentifier,
		dayKey: session.dateKey,
		time: session.startTime,
		durationMinutes: session.durationMinutes,
		excludeDayEntryId: session.dayEntryId,
		excludeLearningPlanSessionId: session._id,
	});

	if (!session.dayEntryId) {
		const dayEntryId = await createSessionDayEntry(ctx, plan, session);
		await ctx.db.patch("learningPlanSessions", session._id, {
			dayEntryId,
			updatedAt: Date.now(),
		});
		return dayEntryId;
	}

	const existingEntry = await ctx.db.get("dayEntries", session.dayEntryId);
	if (
		!existingEntry ||
		existingEntry.ownerTokenIdentifier !== session.ownerTokenIdentifier
	) {
		const dayEntryId = await createSessionDayEntry(ctx, plan, session);
		await ctx.db.patch("learningPlanSessions", session._id, {
			dayEntryId,
			updatedAt: Date.now(),
		});
		return dayEntryId;
	}

	const executionStatus = getSessionExecutionStatus(session);
	await replacePersonalSubjectReference(ctx, {
		ownerTokenIdentifier: session.ownerTokenIdentifier,
		previousPersonalSubjectId: existingEntry.personalSubjectId,
		nextPersonalSubjectId: plan.personalSubjectId,
		target: { targetKind: "dayEntry", dayEntryId: session.dayEntryId },
	});
	await ctx.db.patch("dayEntries", session.dayEntryId, {
		dayKey: session.dateKey,
		title: getSessionDayEntryTitle(plan, session),
		subject: plan.subject,
		personalSubjectId: plan.personalSubjectId,
		time: session.startTime,
		kind: "Lernen",
		notes: getSessionDayEntryNotes(session),
		plannedDateLabel: session.dateLabel,
		durationMinutes: session.durationMinutes,
		completed: isCompletedStatus(executionStatus),
		executionStatus,
		startedAt: session.startedAt,
		outcomeAt: session.outcomeAt,
		missedReason: session.missedReason,
		adjustedFromSessionId: session.adjustedFromSessionId,
		relatedLearningPlanId: session.learningPlanId,
		relatedLearningPlanSessionId: session._id,
	});
	return session.dayEntryId;
};

export const clearSessionDayEntry = async (
	ctx: MutationCtx,
	session: Doc<"learningPlanSessions">,
) => {
	if (!session.dayEntryId) return;

	const dayEntry = await ctx.db.get("dayEntries", session.dayEntryId);
	if (dayEntry?.ownerTokenIdentifier === session.ownerTokenIdentifier) {
		await deleteDayEntryWithPersonalSubjectReference(ctx, session.dayEntryId);
	}
	await ctx.db.patch("learningPlanSessions", session._id, {
		dayEntryId: undefined,
		updatedAt: Date.now(),
	});
};
