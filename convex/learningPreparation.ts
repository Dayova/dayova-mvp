import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { advanceRollingLearningPlan } from "./adaptiveLearningPlan";
import { throwUserFacingError } from "./errors";
import {
	clearSessionDayEntry,
	getAvailabilityDayKeys,
	getSchedulingOccupiedEntries,
	syncSessionDayEntry,
} from "./learningPlanCalendar";
import {
	insertFirstSessionDiagnosticItems,
	validateFirstSessionDiagnosticQuestions,
} from "./learningPlanDiagnostic";
import {
	diagnosticPreparationBudget,
	preparationBudget,
} from "./learningPreparationPolicy";
import { deleteSessionLearningDataForSession } from "./learningSessionContent";
import { getPlanningLearningTimes } from "./learningTimePlanning";
import { deleteDayEntryWithPersonalSubjectReference } from "./personalSubjectReferences";
import {
	berlinNow,
	type PreparationSlot,
	proposePreparationSchedule,
	slotDateLabel,
	splitPreparationSlot,
	timeMinutes,
	validatePreparationSlots,
} from "./preparationSchedule";
import { assertNoScheduleConflict } from "./scheduleConflicts";

const getSessionExecutionStatus = (session: Doc<"learningPlanSessions">) =>
	session.executionStatus ?? (session.completed ? "completed" : "notStarted");
const requireOwnerTokenIdentifier = async (ctx: QueryCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throwUserFacingError("Nicht authentifiziert.");
	return identity.tokenIdentifier;
};
const advanceOwnedRollingLearningPlan = (
	ctx: MutationCtx,
	plan: Doc<"learningPlans">,
) =>
	advanceRollingLearningPlan(ctx, plan, {
		clearSession: clearSessionDayEntry,
		syncSession: syncSessionDayEntry,
	});

async function ownedPreparationPlan(ctx: QueryCtx, id: Id<"learningPlans">) {
	const owner = await requireOwnerTokenIdentifier(ctx);
	const plan = await ctx.db.get("learningPlans", id);
	if (!plan || plan.ownerTokenIdentifier !== owner)
		throwUserFacingError("Lernplan nicht gefunden.");
	return plan;
}
function preparationGroupSlot(group: Doc<"learningPlanSessions">[]) {
	const ordered = [...group].sort((a, b) => a.sortOrder - b.sortOrder);
	const remaining = ordered.filter((s) => !s.completed);
	const visible = remaining.length ? remaining : ordered;
	const first = visible[0];
	return {
		id: first.preparationSlotId ?? "",
		dateKey: first.dateKey.slice(0, 10),
		startTime: first.startTime,
		durationMinutes: visible.reduce((sum, s) => sum + s.durationMinutes, 0),
		locked:
			remaining.length === 0 ||
			remaining.some((s) => getSessionExecutionStatus(s) === "started"),
		completed: remaining.length === 0,
		completedMinutes: remaining.length
			? ordered
					.filter((s) => s.completed)
					.reduce((sum, s) => sum + s.durationMinutes, 0)
			: 0,
	};
}

export async function getDiagnosticBudget(
	ctx: QueryCtx,
	plan: Doc<"learningPlans">,
	sessions: Doc<"learningPlanSessions">[],
) {
	const diagnostic = sessions.find(
		(s) => s.sessionPurpose === "diagnostic" && s.completed,
	);
	if (!diagnostic)
		return diagnosticPreparationBudget(plan.examTypeLabel, 0, 0, 0);
	const attempts = await ctx.db
		.query("learningSessionAnswerAttempts")
		.withIndex("by_sessionId_and_createdAt", (q) =>
			q.eq("sessionId", diagnostic._id),
		)
		.order("asc")
		.take(100);
	const first = new Map<string, (typeof attempts)[number]>();
	for (const attempt of attempts)
		if (!first.has(attempt.itemId)) first.set(attempt.itemId, attempt);
	return diagnosticPreparationBudget(
		plan.examTypeLabel,
		[...first.values()].filter((a) => a.rating === "correct").length,
		first.size,
		diagnostic.activeStudySeconds ?? 0,
	);
}

export async function prepareDiagnostic(
	ctx: MutationCtx,
	args: { learningPlanId: Id<"learningPlans"> },
) {
	const plan = await ownedPreparationPlan(ctx, args.learningPlanId);
	const existing = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", plan._id),
		)
		.first();
	if (existing && plan.preparationState) return existing._id;
	const replacesLegacyDraft =
		existing &&
		plan.status === "questionsReady" &&
		!plan.contentGenerationStage;
	if (plan.status === "accepted" || (existing && !replacesLegacyDraft))
		throwUserFacingError("Dieser Lernplan wurde bereits erstellt.");
	if (!plan.scopeConfirmedAt)
		throwUserFacingError("Bestätige zuerst deinen Prüfungsstoff.");
	const questions = (plan.knowledgeQuestions ?? []).slice(0, 10);
	validateFirstSessionDiagnosticQuestions(questions, plan.topicMap);
	if (replacesLegacyDraft) {
		const legacySessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", plan._id),
			)
			.take(500);
		for (const session of legacySessions) {
			await deleteSessionLearningDataForSession(ctx, session._id);
			await clearSessionDayEntry(ctx, session);
			await ctx.db.delete("learningPlanSessions", session._id);
		}
	}
	const now = Date.now();
	const current = berlinNow();
	const sessionId = await ctx.db.insert("learningPlanSessions", {
		ownerTokenIdentifier: plan.ownerTokenIdentifier,
		learningPlanId: plan._id,
		phase: "practice",
		sessionPurpose: "diagnostic",
		title: "Wissenscheck",
		dateKey: current.dateKey,
		berlinDayKey: current.dateKey,
		dateLabel: slotDateLabel(current.dateKey),
		startTime: `${String(Math.floor(current.minutes / 60)).padStart(2, "0")}:${String(current.minutes % 60).padStart(2, "0")}`,
		durationMinutes: 10,
		unscheduled: true,
		goal: "Finde heraus, was du schon kannst.",
		tasks: ["Beantworte zehn kurze Fragen."],
		expectedOutcome: "Deine Stärken und Übungsschwerpunkte für den Lernplan.",
		compositionVariant: "control",
		planningStatus: "committed",
		contentGenerationStatus: "ready",
		contentGeneratedAt: now,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
	});
	await insertFirstSessionDiagnosticItems(ctx, {
		plan,
		sessionId,
		questions,
		now,
	});
	await ctx.db.patch("learningPlans", plan._id, {
		knowledgeQuestions: questions,
		preparationState: "diagnostic",
		preparationRevision: 0,
		targetStudyMinutes: preparationBudget(plan.examTypeLabel).minutes,
		status: "generated",
		rollingPlanEnabled: true,
		contentGenerationStage: "ready",
		contentGenerationId: undefined,
		contentGenerationStartedAt: undefined,
		contentGenerationFailureReason: undefined,
		contentGenerationFailureMessage: undefined,
		updatedAt: now,
	});
	return sessionId;
}

export async function acceptDiagnostic(
	ctx: MutationCtx,
	args: {
		learningPlanId: Id<"learningPlans">;
		appointment?: { dateKey: string; startTime: string };
	},
) {
	const plan = await ownedPreparationPlan(ctx, args.learningPlanId);
	const session = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", plan._id),
		)
		.first();
	if (!session || session.sessionPurpose !== "diagnostic")
		throwUserFacingError("Der Wissenscheck fehlt noch.");
	if (plan.status === "accepted") return session._id;
	if (args.appointment) {
		const slot = {
			id: "diagnostic",
			...args.appointment,
			durationMinutes: 10,
		};
		const error = validatePreparationSlots([slot], plan.examDateKey);
		if (error) throwUserFacingError(error);
		const now = berlinNow();
		if (
			slot.dateKey < now.dateKey ||
			(slot.dateKey === now.dateKey &&
				(timeMinutes(slot.startTime) ?? 0) <= now.minutes)
		)
			throwUserFacingError("Wähle einen zukünftigen Termin oder starte jetzt.");
		const patch = {
			dateKey: slot.dateKey,
			berlinDayKey: slot.dateKey,
			dateLabel: slotDateLabel(slot.dateKey),
			startTime: slot.startTime,
			unscheduled: false,
		};
		await ctx.db.patch("learningPlanSessions", session._id, patch);
		await syncSessionDayEntry(ctx, plan, { ...session, ...patch });
	}
	await ctx.db.patch("learningPlans", plan._id, {
		status: "accepted",
		acceptedAt: Date.now(),
		updatedAt: Date.now(),
	});
	return session._id;
}

export async function getPreparationSchedule(
	ctx: QueryCtx,
	args: {
		learningPlanId: Id<"learningPlans">;
		now: { dateKey: string; minutes: number };
	},
) {
	const plan = await ownedPreparationPlan(ctx, args.learningPlanId);
	const sessions = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", plan._id),
		)
		.order("desc")
		.take(500);
	const { remainingMinutes, ...budget } = await getDiagnosticBudget(
		ctx,
		plan,
		sessions,
	);
	const groups = new Map<string, typeof sessions>();
	for (const s of sessions) {
		if (s.preparationSlotId && !s.unscheduled) {
			const group = groups.get(s.preparationSlotId) ?? [];
			group.push(s);
			groups.set(s.preparationSlotId, group);
		}
	}
	const slots = Array.from(groups.values(), preparationGroupSlot).sort(
		(a, b) =>
			a.dateKey.localeCompare(b.dateKey) ||
			a.startTime.localeCompare(b.startTime),
	);
	const openFlexibleMinutes = sessions
		.filter((s) => s.unscheduled && s.preparationSlotId && !s.completed)
		.reduce((sum, s) => sum + s.durationMinutes, 0);
	const budgetMinutes = Math.max(0, remainingMinutes - openFlexibleMinutes);
	if (plan.preparationState !== "review" || slots.length)
		return {
			slots,
			revision: plan.preparationRevision ?? 0,
			budgetMinutes,
			...budget,
		};
	const now = args.now;
	const availabilityDayKeys = getAvailabilityDayKeys(
		now.dateKey,
		plan.examDateKey.slice(0, 10),
	);
	const horizonDays = preparationBudget(plan.examTypeLabel).horizonDays;
	const occupied = await getSchedulingOccupiedEntries(ctx, {
		ownerTokenIdentifier: plan.ownerTokenIdentifier,
		dayKeys: availabilityDayKeys.slice(-horizonDays),
	});
	if (occupied.wasTruncated)
		return {
			slots: [],
			revision: plan.preparationRevision ?? 0,
			budgetMinutes,
			...budget,
		};
	const saved = await getPlanningLearningTimes(ctx, plan.ownerTokenIdentifier);
	return {
		slots: proposePreparationSchedule({
			budgetMinutes,
			examTypeLabel: plan.examTypeLabel,
			examDateKey: plan.examDateKey,
			now,
			learningTimes: saved,
			occupiedEntries: occupied.entries,
		}).map((s) => ({
			...s,
			locked: false,
			completed: false,
			completedMinutes: 0,
		})),
		revision: plan.preparationRevision ?? 0,
		budgetMinutes,
		...budget,
	};
}

export async function savePreparationSchedule(
	ctx: MutationCtx,
	args: {
		learningPlanId: Id<"learningPlans">;
		revision: number;
		slots: PreparationSlot[];
	},
) {
	const plan = await ownedPreparationPlan(ctx, args.learningPlanId);
	if (!["review", "ready"].includes(plan.preparationState ?? ""))
		throwUserFacingError("Schließe zuerst den Wissenscheck ab.");
	if (args.revision !== (plan.preparationRevision ?? 0))
		throwUserFacingError(
			"Dein Lernplan wurde inzwischen geändert. Öffne die Termine erneut.",
		);
	const sessions = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", plan._id),
		)
		.take(500);

	const groups = new Map<string, Doc<"learningPlanSessions">[]>();
	for (const session of sessions) {
		if (!session.preparationSlotId || session.unscheduled) continue;
		const group = groups.get(session.preparationSlotId) ?? [];
		group.push(session);
		groups.set(session.preparationSlotId, group);
	}
	const historicalIds = new Set(
		Array.from(groups, ([id, group]) =>
			group.every((s) => s.completed) ? id : "",
		).filter(Boolean),
	);
	const editable = args.slots.filter((s) => !historicalIds.has(s.id));
	const error = editable.length
		? validatePreparationSlots(editable, plan.examDateKey)
		: "Plane mindestens einen offenen Termin ein.";
	if (error) throwUserFacingError(error);
	const reusable = new Map<string, Doc<"learningPlanSessions">>();
	const lockedIds = new Set<string>(); // includes unchanged groups, preserving content and IDs
	for (const [id, group] of groups) {
		const current = preparationGroupSlot(group);
		const proposed = args.slots.find((slot) => slot.id === id);
		const unchanged =
			proposed &&
			proposed.dateKey === current.dateKey &&
			proposed.startTime === current.startTime &&
			proposed.durationMinutes === current.durationMinutes;
		if (current.locked && !unchanged)
			throwUserFacingError(
				"Abgeschlossene und gerade laufende Schritte bleiben erhalten. Ändere die übrigen Termine.",
			);
		if (unchanged) {
			lockedIds.add(id);
			continue;
		}
		const done = group.filter((session) => session.completed);
		const entryId = group.find((session) => session.dayEntryId)?.dayEntryId;
		if (done.length) {
			const historyId = `${id.slice(0, 60)}-done-${args.revision}`;
			for (const session of done)
				await ctx.db.patch("learningPlanSessions", session._id, {
					preparationSlotId: historyId,
				});
			const existingEntry = entryId
				? await ctx.db.get("dayEntries", entryId)
				: null;
			if (existingEntry?.ownerTokenIdentifier === plan.ownerTokenIdentifier)
				await ctx.db.patch("dayEntries", existingEntry._id, {
					durationMinutes: done.reduce(
						(sum, session) => sum + session.durationMinutes,
						0,
					),
					completed: true,
					executionStatus: "completed",
					relatedLearningPlanSessionId: done[0]._id,
				});
		} else if (entryId)
			await deleteDayEntryWithPersonalSubjectReference(ctx, entryId);
		const proposedSteps = proposed ? splitPreparationSlot(proposed) : [];
		for (const [index, session] of group
			.filter((session) => !session.completed)
			.entries()) {
			const attempt = await ctx.db
				.query("learningSessionAnswerAttempts")
				.withIndex("by_sessionId_and_createdAt", (q) =>
					q.eq("sessionId", session._id),
				)
				.first();
			const hasWork = Boolean(attempt) || (session.activeStudySeconds ?? 0) > 0;
			if (proposedSteps[index]?.durationMinutes === session.durationMinutes) {
				reusable.set(`${id}:${index}`, session);
			} else {
				if (hasWork)
					throwUserFacingError(
						"Erhalte die Dauer des bereits begonnenen Schritts. Du kannst seinen Termin verschieben.",
					);
				await deleteSessionLearningDataForSession(ctx, session._id);
				await ctx.db.delete("learningPlanSessions", session._id);
			}
		}
	}

	const retainedCount = sessions.filter(
		(session) =>
			session.completed ||
			session.unscheduled ||
			!session.preparationSlotId ||
			lockedIds.has(session.preparationSlotId),
	).length;
	const createdCount = args.slots
		.filter((slot) => !lockedIds.has(slot.id))
		.reduce((sum, slot) => sum + splitPreparationSlot(slot).length, 0);
	if (retainedCount + createdCount > 500)
		throwUserFacingError(
			"Dieser Lernplan enthält bereits sehr viele Schritte. Plane weniger zusätzliche Zeit ein.",
		);

	const now = berlinNow();
	const sorted = [...args.slots].sort(
		(a, b) =>
			a.dateKey.localeCompare(b.dateKey) ||
			a.startTime.localeCompare(b.startTime),
	);
	// Reserved slots are written transactionally; competing plans retry and see these events.
	for (const slot of sorted) {
		if (lockedIds.has(slot.id)) continue;
		if (
			slot.dateKey < now.dateKey ||
			(slot.dateKey === now.dateKey &&
				(timeMinutes(slot.startTime) ?? 0) <= now.minutes)
		)
			throwUserFacingError(
				"Ein Termin liegt bereits in der Vergangenheit. Passe ihn an; du kannst danach sofort starten.",
			);
		await assertNoScheduleConflict(ctx, {
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
			dayKey: slot.dateKey,
			time: slot.startTime,
			durationMinutes: slot.durationMinutes,
		});
	}
	let order =
		Math.max(
			0,
			...sessions
				.filter(
					(s) =>
						s.unscheduled ||
						!s.preparationSlotId ||
						lockedIds.has(s.preparationSlotId),
				)
				.map((s) => s.sortOrder),
		) + 1;
	for (const slot of sorted) {
		if (lockedIds.has(slot.id)) continue;
		let firstId: Id<"learningPlanSessions"> | undefined;
		for (const [stepIndex, step] of splitPreparationSlot(slot).entries()) {
			const previous = reusable.get(`${slot.id}:${stepIndex}`);
			if (previous) {
				await ctx.db.patch("learningPlanSessions", previous._id, {
					dateKey: slot.dateKey,
					berlinDayKey: slot.dateKey,
					dateLabel: slotDateLabel(slot.dateKey),
					...step,
					dayEntryId: undefined,
					unscheduled: false,
					planningStatus: "provisional",
					sortOrder: order++,
					updatedAt: Date.now(),
				});
				firstId ??= previous._id;
				continue;
			}
			const id = await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: plan.ownerTokenIdentifier,
				learningPlanId: plan._id,
				preparationSlotId: slot.id,
				phase: "practice",
				sessionPurpose: "learning",
				title: "Dein nächster Lernschritt",
				dateKey: slot.dateKey,
				berlinDayKey: slot.dateKey,
				dateLabel: slotDateLabel(slot.dateKey),
				...step,
				goal: "Übe passend zu deinem Wissensstand.",
				tasks: [],
				expectedOutcome: "Ein weiterer Schritt in deiner Vorbereitung.",
				planningStatus: "provisional",
				sortOrder: order++,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			firstId ??= id;
		}
		if (firstId) {
			const first = await ctx.db.get("learningPlanSessions", firstId);
			if (first) await syncSessionDayEntry(ctx, plan, first);
		}
	}
	const reordered = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", plan._id),
		)
		.take(500);
	reordered.sort(
		(a, b) =>
			Number(b.completed === true) - Number(a.completed === true) ||
			a.dateKey.localeCompare(b.dateKey) ||
			a.startTime.localeCompare(b.startTime) ||
			a.sortOrder - b.sortOrder,
	);
	for (const [sortOrder, session] of reordered.entries())
		if (session.sortOrder !== sortOrder)
			await ctx.db.patch("learningPlanSessions", session._id, { sortOrder });
	await ctx.db.patch("learningPlans", plan._id, {
		preparationState: "ready",
		preparationRevision: (plan.preparationRevision ?? 0) + 1,
		updatedAt: Date.now(),
	});
	await advanceOwnedRollingLearningPlan(ctx, {
		...plan,
		preparationState: "ready",
	});
	return null;
}

export async function startFlexiblePreparation(
	ctx: MutationCtx,
	args: { learningPlanId: Id<"learningPlans"> },
) {
	const plan = await ownedPreparationPlan(ctx, args.learningPlanId);
	if (plan.preparationState !== "review")
		throwUserFacingError("Dein Lernplan wurde bereits übernommen.");
	const previous = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", plan._id),
		)
		.take(500);
	if (previous.some((s) => s.preparationSlotId))
		throwUserFacingError("Dein Lernplan enthält bereits Lernschritte.");
	const now = berlinNow();
	const clock = `${String(Math.floor(now.minutes / 60)).padStart(2, "0")}:${String(now.minutes % 60).padStart(2, "0")}`;
	let order = Math.max(0, ...previous.map((s) => s.sortOrder)) + 1;
	let first: Id<"learningPlanSessions"> | undefined;
	for (
		let remaining = (await getDiagnosticBudget(ctx, plan, previous))
			.remainingMinutes;
		remaining > 0;
		remaining -= 10
	) {
		const sessionId = await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
			learningPlanId: plan._id,
			preparationSlotId: "flexible",
			unscheduled: true,
			phase: "practice",
			sessionPurpose: "learning",
			title: "Dein nächster Lernschritt",
			dateKey: now.dateKey,
			berlinDayKey: now.dateKey,
			dateLabel: slotDateLabel(now.dateKey),
			startTime: clock,
			durationMinutes: Math.min(10, remaining),
			goal: "Übe passend zu deinem Wissensstand.",
			tasks: [],
			expectedOutcome: "Ein weiterer Schritt in deiner Vorbereitung.",
			planningStatus: "provisional",
			sortOrder: order++,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
		first ??= sessionId;
	}
	await ctx.db.patch("learningPlans", plan._id, {
		preparationState: "ready",
		preparationRevision: (plan.preparationRevision ?? 0) + 1,
		updatedAt: Date.now(),
	});
	await advanceOwnedRollingLearningPlan(ctx, {
		...plan,
		preparationState: "ready",
	});
	if (!first) {
		await ctx.db.patch("learningPlans", plan._id, {
			preparationState: "completed",
		});
		const diagnostic = previous.find((s) => s.sessionPurpose === "diagnostic");
		if (!diagnostic) throwUserFacingError("Der Wissenscheck fehlt noch.");
		return diagnostic._id;
	}
	return first;
}

export async function createAdditionalPractice(
	ctx: MutationCtx,
	args: {
		learningPlanId: Id<"learningPlans">;
		topicId: string;
		durationMinutes: number;
	},
) {
	const plan = await ownedPreparationPlan(ctx, args.learningPlanId);
	if (plan.preparationState !== "completed")
		throwUserFacingError("Schließe zuerst die geplanten Schritte ab.");
	const topic = plan.topicMap?.find((t) => t.id === args.topicId);
	if (!topic) throwUserFacingError("Wähle ein Thema aus deinem Lernplan.");
	if (![5, 10, 15, 20, 30].includes(args.durationMinutes))
		throwUserFacingError("Wähle 5, 10, 15, 20 oder 30 Minuten.");
	const last = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", plan._id),
		)
		.order("desc")
		.first();
	// Repeated taps and concurrent clients reuse the one open voluntary unit.
	if (
		last?.additionalPractice &&
		["notStarted", "started"].includes(getSessionExecutionStatus(last))
	)
		return last._id;
	const now = berlinNow();
	return await ctx.db.insert("learningPlanSessions", {
		ownerTokenIdentifier: plan.ownerTokenIdentifier,
		learningPlanId: plan._id,
		additionalPractice: true,
		unscheduled: true,
		phase: "practice",
		sessionPurpose: "learning",
		title: topic.title,
		dateKey: now.dateKey,
		berlinDayKey: now.dateKey,
		dateLabel: slotDateLabel(now.dateKey),
		startTime: `${String(Math.floor(now.minutes / 60)).padStart(2, "0")}:${String(now.minutes % 60).padStart(2, "0")}`,
		durationMinutes: args.durationMinutes,
		goal: topic.learningGoal,
		tasks: [],
		expectedOutcome: "Du hast dein Wissen weiter vertieft.",
		targetTopicIds: [topic.id],
		targetEvidenceDimension: "problemSolving",
		planningStatus: "committed",
		contentGenerationStatus: "queued",
		sortOrder: (last?.sortOrder ?? 0) + 1,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	});
}

export async function deleteRemainingPreparationSessions(
	ctx: MutationCtx,
	args: { learningPlanId: Id<"learningPlans">; ownerTokenIdentifier: string },
) {
	const sessions = await ctx.db
		.query("learningPlanSessions")
		.withIndex("by_learningPlanId_and_sortOrder", (q) =>
			q.eq("learningPlanId", args.learningPlanId),
		)
		.take(50);
	for (const session of sessions) {
		if (session.ownerTokenIdentifier !== args.ownerTokenIdentifier)
			throwUserFacingError("Ungültiger Lernplan.");
		await deleteSessionLearningDataForSession(ctx, session._id);
		if (session.dayEntryId) {
			const entry = await ctx.db.get("dayEntries", session.dayEntryId);
			if (entry?.ownerTokenIdentifier === args.ownerTokenIdentifier)
				await deleteDayEntryWithPersonalSubjectReference(ctx, entry._id);
		}
		await ctx.db.delete("learningPlanSessions", session._id);
	}
	if (sessions.length === 50)
		await ctx.scheduler.runAfter(
			0,
			internal.learningPlans.deleteRemainingPreparationSessions,
			args,
		);
	return null;
}
