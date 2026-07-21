/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { USER_FACING_ERROR_KIND } from "./errors";
import { MISSING_LEARNING_TIMES_HINT } from "./learningPlanPlanningHints";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type TestBackend = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

const user = {
	tokenIdentifier: "test:user",
};

const createPlan = async (t: TestBackend) => {
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-05",
		title: "Mathe Klausur",
		time: "09:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "5. Juni 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});

	return await t.mutation(api.learningPlans.start, {
		examDayEntryId,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-06-05",
		examDateLabel: "5. Juni 2026",
		examTime: "09:00",
		durationMinutes: 90,
		topicDescription: "Lineare Funktionen",
	});
};

const createAcceptedPlanWithSession = async (
	t: TestBackend,
	overrides: Partial<{
		phase: "theory" | "practice" | "rehearsal";
		title: string;
		dateKey: string;
		dateLabel: string;
		startTime: string;
		durationMinutes: number;
	}> = {},
) => {
	const learningPlanId = await createPlan(t);
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		sessions: [
			{
				phase: overrides.phase ?? "practice",
				title: overrides.title ?? "Üben",
				dateKey: overrides.dateKey ?? "2026-06-01",
				dateLabel: overrides.dateLabel ?? "1. Juni 2026",
				startTime: overrides.startTime ?? "17:00",
				durationMinutes: overrides.durationMinutes ?? 30,
				goal: "Kurz wiederholen.",
				tasks: ["Begriffe prüfen", "Aufgaben lösen"],
				expectedOutcome: "Du bist vorbereitet.",
			},
		],
	});
	await t.mutation(api.learningPlans.acceptPlan, { learningPlanId });
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const session = snapshot?.sessions[0];
	if (!session) throw new Error("Expected an accepted learning plan session.");
	return { learningPlanId, session };
};

test("persists the split experiment assignment on an eligible theory session", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		sessionCompositionVariant: "split",
		sessions: [
			{
				phase: "theory",
				title: "Theorie",
				dateKey: "2026-06-01",
				dateLabel: "1. Juni 2026",
				startTime: "17:00",
				durationMinutes: 30,
				goal: "Grundlagen verstehen.",
				tasks: ["Begriffe erklären", "Beispiele prüfen"],
				expectedOutcome: "Du verstehst die Grundlagen.",
			},
		],
	});

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.plan.sessionCompositionVariant).toBe("split");
	expect(snapshot?.sessions[0]?.compositionVariant).toBe("split");
});

test("stores the total study workload confirmed before generation", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(api.learningPlans.setTargetStudyMinutes, {
		learningPlanId,
		targetStudyMinutes: 50,
	});

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.plan.targetStudyMinutes).toBe(50);
});

test("keeps a plan in generation until every session content payload is ready", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		deferReadyUntilContent: true,
		sessions: [
			{
				phase: "practice",
				title: "Üben",
				dateKey: "2026-06-01",
				dateLabel: "1. Juni 2026",
				startTime: "17:00",
				durationMinutes: 15,
				goal: "Gleichungen lösen.",
				tasks: ["Löse zwei Gleichungen."],
				expectedOutcome: "Du löst Gleichungen sicher.",
			},
		],
	});

	const generating = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(generating?.plan.status).toBe("questionsReady");
	expect(generating?.plan.contentGeneration).toEqual({
		stage: "content",
		totalSessionCount: 1,
		readySessionCount: 0,
		failedSessionCount: 0,
	});
	expect(generating?.sessions[0]?.contentGenerationStatus).toBe("queued");

	const sessionId = generating?.sessions[0]?.id;
	if (!sessionId) throw new Error("Expected generated session.");
	await expect(
		t.mutation(
			internal.learningPlans.claimIncompleteContentGenerationSessions,
			{
				learningPlanId,
				generationId: "content-generation",
			},
		),
	).resolves.toEqual([sessionId]);
	await t.mutation(internal.learningPlans.setSessionContentGenerationStatus, {
		sessionId,
		status: "ready",
	});
	await t.mutation(internal.learningPlans.finalizeContentGeneration, {
		learningPlanId,
		generationId: "content-generation",
	});

	const ready = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(ready?.plan.status).toBe("generated");
	expect(ready?.plan.contentGeneration?.stage).toBe("ready");
});

test("claims plan generation atomically and persists an empty failed claim for explicit retry", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await t.mutation(internal.learningPlans.beginContentGeneration, {
		learningPlanId,
		generationId: "generation-1",
	});

	await expect(
		t.mutation(internal.learningPlans.beginContentGeneration, {
			learningPlanId,
			generationId: "generation-2",
		}),
	).rejects.toThrow("Dieser Lernplan wird bereits erstellt.");
	await expect(
		t.mutation(internal.learningPlans.clearEmptyContentGeneration, {
			learningPlanId,
			generationId: "generation-1",
		}),
	).resolves.toBe(true);
	const failed = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(failed?.plan.contentGeneration?.stage).toBe("failed");
	await expect(
		t.mutation(internal.learningPlans.beginContentGeneration, {
			learningPlanId,
			generationId: "generation-2",
		}),
	).resolves.toBeTypeOf("number");
});

test("allows generation recovery only after the eleven-minute stale boundary", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await t.mutation(internal.learningPlans.beginContentGeneration, {
		learningPlanId,
		generationId: "long-generation",
	});

	vi.advanceTimersByTime(11 * 60_000 - 1);
	await expect(
		t.mutation(internal.learningPlans.beginContentGeneration, {
			learningPlanId,
			generationId: "duplicate-generation",
		}),
	).rejects.toThrow("Dieser Lernplan wird bereits erstellt.");

	vi.advanceTimersByTime(1);
	await expect(
		t.mutation(internal.learningPlans.beginContentGeneration, {
			learningPlanId,
			generationId: "recovery-generation",
		}),
	).resolves.toBeTypeOf("number");
});

test("atomically claims stale session retries and rejects a second claimant", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await t.mutation(internal.learningPlans.beginContentGeneration, {
		learningPlanId,
		generationId: "active-generation",
	});
	const generated = await t.mutation(
		internal.learningPlans.replaceGeneratedSessions,
		{
			learningPlanId,
			generationId: "active-generation",
			knowledgeAnswersJson: "[]",
			sourceSummary: "Testmaterial",
			insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
			deferReadyUntilContent: true,
			sessions: [
				{
					phase: "practice",
					title: "Üben",
					dateKey: "2026-06-01",
					dateLabel: "1. Juni 2026",
					startTime: "17:00",
					durationMinutes: 15,
					goal: "Kurz wiederholen.",
					tasks: ["Aufgaben lösen"],
					expectedOutcome: "Du bist vorbereitet.",
				},
			],
		},
	);
	if (!generated) throw new Error("Expected deferred session generation.");

	await expect(
		t.mutation(
			internal.learningPlans.claimIncompleteContentGenerationSessions,
			{
				learningPlanId,
				generationId: "early-retry",
			},
		),
	).rejects.toThrow("Dieser Lernplan wird bereits erstellt.");

	vi.advanceTimersByTime(11 * 60_000);
	await expect(
		t.mutation(
			internal.learningPlans.claimIncompleteContentGenerationSessions,
			{
				learningPlanId,
				generationId: "claimed-retry",
			},
		),
	).resolves.toEqual(generated.sessionIds);
	await expect(
		t.mutation(
			internal.learningPlans.claimIncompleteContentGenerationSessions,
			{
				learningPlanId,
				generationId: "duplicate-retry",
			},
		),
	).rejects.toThrow("Dieser Lernplan wird bereits erstellt.");
	await expect(
		t.mutation(internal.learningPlans.markContentGenerationClaimFailed, {
			learningPlanId,
			generationId: "outdated-retry",
		}),
	).resolves.toBe(false);
	await expect(
		t.mutation(internal.learningPlans.markContentGenerationClaimFailed, {
			learningPlanId,
			generationId: "claimed-retry",
		}),
	).resolves.toBe(true);
	await expect(
		t.mutation(
			internal.learningPlans.claimIncompleteContentGenerationSessions,
			{
				learningPlanId,
				generationId: "retry-after-failure",
			},
		),
	).resolves.toEqual(generated.sessionIds);
});

test("invalidates only educational session edits while calendar moves preserve content", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		sessions: [
			{
				phase: "practice",
				title: "Üben",
				dateKey: "2026-06-01",
				dateLabel: "1. Juni 2026",
				startTime: "17:00",
				durationMinutes: 15,
				goal: "Gleichungen lösen.",
				tasks: ["Löse zwei Gleichungen."],
				expectedOutcome: "Du löst Gleichungen sicher.",
			},
		],
	});
	const initial = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const session = initial?.sessions[0];
	if (!session) throw new Error("Expected generated session.");
	await t.mutation(
		internal.learningSessionContent.ensureFallbackSessionContent,
		{
			sessionId: session.id,
		},
	);
	const contentBefore = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId: session.id },
	);
	const firstItem = contentBefore.items[0];
	if (!firstItem?.choices[0]) throw new Error("Expected fallback MC item.");
	await t.mutation(api.learningSessionContent.submitAnswer, {
		itemId: firstItem.id,
		selectedChoiceId: firstItem.choices[0].id,
	});
	await t.mutation(api.learningSessionContent.finishSessionContent, {
		sessionId: session.id,
	});

	await expect(
		t.mutation(api.learningPlans.updateSession, {
			id: session.id,
			phase: session.phase,
			dateKey: "2026-06-02",
			dateLabel: "2. Juni 2026",
			startTime: "18:00",
			durationMinutes: session.durationMinutes,
		}),
	).resolves.toEqual({ contentInvalidated: false });
	const contentAfterMove = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId: session.id },
	);
	expect(contentAfterMove.items).toHaveLength(contentBefore.items.length);
	expect(contentAfterMove.analysis).not.toBeNull();

	await expect(
		t.mutation(api.learningPlans.updateSession, {
			id: session.id,
			phase: "theory",
			dateKey: "2026-06-02",
			dateLabel: "2. Juni 2026",
			startTime: "18:00",
			durationMinutes: 20,
		}),
	).resolves.toEqual({ contentInvalidated: true });
	const afterEducationalEdit = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const contentAfterEducationalEdit = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId: session.id },
	);
	expect(contentAfterEducationalEdit.items).toHaveLength(0);
	expect(contentAfterEducationalEdit.attempts).toHaveLength(0);
	expect(contentAfterEducationalEdit.analysis).toBeNull();
	expect(afterEducationalEdit?.sessions[0]?.contentGenerationStatus).toBe(
		"queued",
	);
});

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-05-30T10:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

test("adding a learning plan session into an occupied time range is rejected with conflict details", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-31",
		title: "Deutsch Hausaufgabe",
		time: "17:10",
		kind: "Hausaufgabe",
		plannedDateLabel: "31. Mai 2026",
		durationMinutes: 30,
	});

	await expect(
		t.mutation(api.learningPlans.addSession, { learningPlanId }),
	).rejects.toThrow(
		'Dieser Zeitraum überschneidet sich mit "Deutsch Hausaufgabe" am 31. Mai 2026 von 17:10 bis 17:40.',
	);
});

test("moving a learning plan session into an occupied time range is rejected with conflict details", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await t.mutation(api.learningPlans.addSession, { learningPlanId });
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const session = snapshot?.sessions[0];
	if (!session) throw new Error("Expected a learning plan session.");

	await t.mutation(api.dayEntries.create, {
		dayKey: session.dateKey,
		title: "Deutsch Hausaufgabe",
		time: "18:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "31. Mai 2026",
		durationMinutes: 30,
	});

	await expect(
		t.mutation(api.learningPlans.updateSession, {
			id: session.id,
			phase: session.phase,
			dateKey: session.dateKey,
			dateLabel: session.dateLabel,
			startTime: "18:15",
			durationMinutes: 45,
		}),
	).rejects.toThrow(
		'Dieser Zeitraum überschneidet sich mit "Deutsch Hausaufgabe" am 31. Mai 2026 von 18:00 bis 18:30.',
	);
});

test("updating a learning plan session at its own synced time is allowed", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await t.mutation(api.learningPlans.addSession, { learningPlanId });
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const session = snapshot?.sessions[0];
	if (!session) throw new Error("Expected a learning plan session.");

	await expect(
		t.mutation(api.learningPlans.updateSession, {
			id: session.id,
			phase: "theory",
			dateKey: session.dateKey,
			dateLabel: session.dateLabel,
			startTime: session.startTime,
			durationMinutes: session.durationMinutes,
		}),
	).resolves.toEqual({ contentInvalidated: true });
});

test("starting a learning plan rejects vague exam topic descriptions", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-05",
		title: "Mathe Klausur",
		time: "09:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "5. Juni 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});

	const startWithVagueTopic = () =>
		t.mutation(api.learningPlans.start, {
			examDayEntryId,
			subject: "Mathe",
			examTypeLabel: "Klausur",
			examDateKey: "2026-06-05",
			examDateLabel: "5. Juni 2026",
			examTime: "09:00",
			durationMinutes: 90,
			topicDescription: "asdf test",
		});
	await expect(startWithVagueTopic()).rejects.toThrow(
		"Beschreibe das Prüfungsthema bitte genauer.",
	);
	await expect(startWithVagueTopic()).rejects.toMatchObject({
		data: {
			kind: USER_FACING_ERROR_KIND,
			message: "Beschreibe das Prüfungsthema bitte genauer.",
		},
	});
});

test("creating a draft learning plan allows incomplete exam topic descriptions", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-05",
		title: "Mathe Klausur",
		time: "09:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "5. Juni 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});

	const learningPlanId = await t.mutation(api.learningPlans.createDraft, {
		examDayEntryId,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-06-05",
		examDateLabel: "5. Juni 2026",
		examTime: "09:00",
		durationMinutes: 90,
		topicDescription: "Mathe",
	});
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});

	expect(snapshot?.plan).toMatchObject({
		status: "draft",
		topicDescription: "Mathe",
	});
	expect(snapshot?.plan.examTime).toBeUndefined();
});

test("generated draft sessions are not synced as calendar entries before acceptance", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await expect(
		t.mutation(internal.learningPlans.replaceGeneratedSessions, {
			learningPlanId,
			knowledgeAnswersJson: "[]",
			sourceSummary: "Testmaterial",
			insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
			sessions: [
				{
					phase: "practice",
					title: "Üben",
					dateKey: "2026-06-05",
					dateLabel: "5. Juni 2026",
					startTime: "09:00",
					durationMinutes: 30,
					goal: "Kurz wiederholen.",
					tasks: ["Begriffe prüfen"],
					expectedOutcome: "Du bist vorbereitet.",
				},
			],
		}),
	).resolves.toBeNull();

	const createdId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-05",
		title: "Physik Test",
		time: "11:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "5. Juni 2026",
		durationMinutes: 45,
		examTypeLabel: "Test",
	});

	expect(createdId).toBeTruthy();
});

test("AI context includes timed homework during the plan scheduling window", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-01",
		title: "Informatik Hausaufgabe",
		time: "17:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "1. Juni 2026",
		durationMinutes: 30,
	});

	const context = await t.query(internal.learningPlans.getAiContext, {
		learningPlanId,
	});

	expect(context.occupiedEntries).toContainEqual({
		dayKey: "2026-06-01",
		time: "17:00",
		durationMinutes: 30,
	});
});

test("review sessions are only synced after the plan is accepted", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		sessions: [
			{
				phase: "practice",
				title: "Üben",
				dateKey: "2026-06-04",
				dateLabel: "4. Juni 2026",
				startTime: "17:00",
				durationMinutes: 30,
				goal: "Kurz wiederholen.",
				tasks: ["Begriffe prüfen"],
				expectedOutcome: "Du bist vorbereitet.",
			},
		],
	});

	await expect(
		t.mutation(api.learningPlans.syncSessionsToCalendar, { learningPlanId }),
	).rejects.toThrow("Bestätige den Lernplan zuerst.");

	const beforeAccept = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-04"],
	});
	expect(beforeAccept["2026-06-04"]).toHaveLength(0);

	await t.mutation(api.learningPlans.acceptPlan, { learningPlanId });

	const afterAccept = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-04"],
	});
	expect(afterAccept["2026-06-04"]).toHaveLength(1);
	expect(afterAccept["2026-06-04"]?.[0]?.kind).toBe("Lernen");
});

test("learning plan sessions move from started to completed and sync calendar state", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const { learningPlanId, session } = await createAcceptedPlanWithSession(t);

	const started = await t.mutation(api.learningPlans.startSession, {
		sessionId: session.id,
	});
	expect(started).toMatchObject({
		learningPlanId,
		learningPlanSessionId: session.id,
		phase: "practice",
		plannedDayKey: "2026-06-01",
	});

	let snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.sessions[0]).toMatchObject({
		executionStatus: "started",
		completed: false,
	});
	let entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-01"],
	});
	expect(entries["2026-06-01"]?.[0]).toMatchObject({
		executionStatus: "started",
		completed: false,
	});

	const completed = await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: session.id,
		outcome: "completed",
		activeStudySeconds: 1_440,
	});
	expect(completed).toMatchObject({
		outcome: "completed",
		learningPlanSessionId: session.id,
		activeStudySeconds: 1_440,
	});

	snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.sessions[0]).toMatchObject({
		executionStatus: "completed",
		completed: true,
	});
	entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-01"],
	});
	expect(entries["2026-06-01"]?.[0]).toMatchObject({
		executionStatus: "completed",
		completed: true,
	});
});

test("recording a learning plan session outcome requires the session to be started", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const { session } = await createAcceptedPlanWithSession(t);

	await expect(
		t.mutation(api.learningPlans.recordSessionOutcome, {
			sessionId: session.id,
			outcome: "completed",
		}),
	).rejects.toThrow("Starte den Lernblock zuerst.");
});

test("partially completed learning plan sessions stay incomplete but keep the outcome", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const { learningPlanId, session } = await createAcceptedPlanWithSession(t, {
		dateKey: "2026-06-02",
		dateLabel: "2. Juni 2026",
	});

	await t.mutation(api.learningPlans.startSession, { sessionId: session.id });
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: session.id,
		outcome: "partiallyCompleted",
	});

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.sessions[0]).toMatchObject({
		executionStatus: "partiallyCompleted",
		completed: false,
	});
	const entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-02"],
	});
	expect(entries["2026-06-02"]?.[0]).toMatchObject({
		executionStatus: "partiallyCompleted",
		completed: false,
	});
});

test("missed learning plan sessions can be adjusted into a linked recovery block", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const { learningPlanId, session } = await createAcceptedPlanWithSession(t, {
		dateKey: "2026-06-03",
		dateLabel: "3. Juni 2026",
	});

	await t.mutation(api.learningPlans.missSession, {
		sessionId: session.id,
		reason: "no_time",
	});
	const adjusted = await t.mutation(api.learningPlans.adjustMissedSession, {
		sessionId: session.id,
		dateKey: "2026-06-03",
		dateLabel: "3. Juni 2026",
		startTime: "17:30",
		durationMinutes: 15,
	});

	expect(adjusted).toMatchObject({
		learningPlanSessionId: session.id,
		newDateKey: "2026-06-03",
		newDurationMinutes: 15,
		missedReason: "no_time",
	});
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.sessions).toHaveLength(2);
	expect(snapshot?.sessions[0]).toMatchObject({
		executionStatus: "adjusted",
		missedReason: "no_time",
		completed: false,
	});
	expect(snapshot?.sessions[1]).toMatchObject({
		adjustedFromSessionId: session.id,
		executionStatus: "notStarted",
		durationMinutes: 15,
	});
});

test("removing a learning plan deletes synced sessions and detaches the exam entry", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		sessions: [
			{
				phase: "practice",
				title: "Üben",
				dateKey: "2026-06-04",
				dateLabel: "4. Juni 2026",
				startTime: "17:00",
				durationMinutes: 30,
				goal: "Kurz wiederholen.",
				tasks: ["Begriffe prüfen"],
				expectedOutcome: "Du bist vorbereitet.",
			},
		],
	});
	await t.mutation(api.learningPlans.acceptPlan, { learningPlanId });

	await expect(
		t.mutation(api.learningPlans.removePlan, { id: learningPlanId }),
	).resolves.toBe(learningPlanId);

	await expect(
		t.query(api.learningPlans.getSnapshot, { id: learningPlanId }),
	).resolves.toBeNull();
	await expect(t.query(api.learningPlans.listOverview, {})).resolves.toEqual(
		[],
	);

	const learningEntries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-04"],
	});
	expect(learningEntries["2026-06-04"]).toHaveLength(0);

	const examEntries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-05"],
	});
	expect(examEntries["2026-06-05"]).toHaveLength(1);
	expect(examEntries["2026-06-05"]?.[0]).toMatchObject({
		title: "Mathe Klausur",
		kind: "Leistungskontrolle",
	});
	expect(examEntries["2026-06-05"]?.[0]).not.toHaveProperty(
		"relatedLearningPlanId",
	);
});

test("generated plans can advance to review without available sessions", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		planningHint: "Keine freie Lernzeit gefunden.",
		sessions: [],
	});

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});

	expect(snapshot?.plan.status).toBe("generated");
	expect(snapshot?.sessions).toHaveLength(0);
	expect(snapshot?.plan.planningHint).toBe("Keine freie Lernzeit gefunden.");
});

test("snapshot clears stale missing-learning-times hints after learning times are saved", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		planningHint: `${MISSING_LEARNING_TIMES_HINT} 0/135 Min. geplant.`,
		sessions: [],
	});

	expect(
		(
			await t.query(api.learningPlans.getSnapshot, {
				id: learningPlanId,
			})
		)?.plan.planningHint,
	).toBe(`${MISSING_LEARNING_TIMES_HINT} 0/135 Min. geplant.`);

	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 1,
		startTime: "17:00",
		endTime: "18:00",
	});

	expect(
		(
			await t.query(api.learningPlans.getSnapshot, {
				id: learningPlanId,
			})
		)?.plan.planningHint,
	).toBe("0/135 Min. geplant.");

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		planningHint: MISSING_LEARNING_TIMES_HINT,
		sessions: [],
	});

	expect(
		(
			await t.query(api.learningPlans.getSnapshot, {
				id: learningPlanId,
			})
		)?.plan.planningHint,
	).toBeUndefined();
});

test("generated knowledge questions reject malformed control characters before storage", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await expect(
		t.mutation(internal.learningPlans.storeKnowledgeQuestions, {
			learningPlanId,
			sourceSummary:
				"Die Unterlagen behandeln Ger\u0004teklassen und inklusive Arbeitspl\u0004tze.",
			questions: [
				{
					id: "q1",
					prompt:
						"Welche technischen Hilfsmittel k\u0004nnten f\u0004r eine Person mit Sehbeeintr\u0004chtigung zum Einsatz kommen?",
					targetInsight:
						"Pr\u0004ft das Verst\u0004ndnis f\u0004r konkrete L\u0004sungsans\u0004tze.",
				},
			],
		}),
	).rejects.toThrow("ungültige Sonderzeichen");

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});

	expect(snapshot?.plan.status).toBe("draft");
	expect(snapshot?.plan.knowledgeQuestions).toEqual([]);
});

test("stores a reusable topic map with generated knowledge questions", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(internal.learningPlans.storeKnowledgeQuestions, {
		learningPlanId,
		sourceSummary: "Lineare Funktionen mit Steigung und Achsenabschnitt.",
		topics: [
			{
				id: "steigung",
				title: "Steigung",
				learningGoal: "Die Steigung berechnen und in Graphen erkennen.",
				keywords: ["Steigung", "Differenz"],
				priority: "high",
			},
			{
				id: "achsenabschnitt",
				title: "Achsenabschnitt",
				learningGoal: "Den y-Achsenabschnitt bestimmen.",
				keywords: ["Achsenabschnitt"],
				priority: "medium",
			},
		],
		questions: [
			{
				id: "q1",
				prompt: "Wie berechnest du die Steigung einer linearen Funktion?",
				targetInsight: "Prüft das Verständnis der Steigungsberechnung.",
			},
		],
	});

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});

	expect(snapshot?.plan.topicMap).toEqual([
		{
			id: "steigung",
			title: "Steigung",
			learningGoal: "Die Steigung berechnen und in Graphen erkennen.",
			keywords: ["Steigung", "Differenz"],
			priority: "high",
		},
		{
			id: "achsenabschnitt",
			title: "Achsenabschnitt",
			learningGoal: "Den y-Achsenabschnitt bestimmen.",
			keywords: ["Achsenabschnitt"],
			priority: "medium",
		},
	]);
});

test("generated plan sessions reject malformed control characters without replacing the existing plan", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Zusammenfassung für Geräteklassen.",
		insight: {
			summary: "Verständnis für Lösungen prüfen.",
			strengths: ["Schueler erkennt Geraete."],
			gaps: ["Lösungen für Arbeitsplätze"],
		},
		sessions: [
			{
				phase: "practice",
				title: "Übung für Geräte",
				dateKey: "2026-06-03T00:00:00.000Z",
				dateLabel: "3. Juni 2026",
				startTime: "17:00",
				durationMinutes: 45,
				goal: "Prüfe Lösungen für Geräteklassen.",
				tasks: ["Loesungen sammeln", "Hilfsmittel für Arbeitsplätze bewerten"],
				expectedOutcome: "Schüler kennt Lösungsansätze.",
			},
		],
	});

	await expect(
		t.mutation(internal.learningPlans.replaceGeneratedSessions, {
			learningPlanId,
			knowledgeAnswersJson: "[]",
			sourceSummary: "Zusammenfassung f\u0004r Ger\u0004teklassen.",
			insight: {
				summary: "Verständnis für Lösungen prüfen.",
				strengths: [],
				gaps: ["Lösungen für Arbeitsplätze"],
			},
			sessions: [
				{
					phase: "practice",
					title: "Übung für Geräte",
					dateKey: "2026-06-04T00:00:00.000Z",
					dateLabel: "4. Juni 2026",
					startTime: "18:00",
					durationMinutes: 45,
					goal: "Prüfe Lösungen für Geräteklassen.",
					tasks: ["Lösungen sammeln"],
					expectedOutcome: "Schüler kennt Lösungsansätze.",
				},
			],
		}),
	).rejects.toThrow("ungültige Sonderzeichen");

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});

	expect(snapshot?.plan.sourceSummary).toBe(
		"Zusammenfassung für Geräteklassen.",
	);
	expect(snapshot?.plan.insight).toEqual({
		summary: "Verständnis für Lösungen prüfen.",
		strengths: ["Schüler erkennt Geräte."],
		gaps: ["Lösungen für Arbeitsplätze"],
	});
	expect(snapshot?.sessions).toHaveLength(1);
	expect(snapshot?.sessions[0]).toMatchObject({
		title: "Übung für Geräte",
		goal: "Prüfe Lösungen für Geräteklassen.",
		tasks: ["Lösungen sammeln", "Hilfsmittel für Arbeitsplätze bewerten"],
		expectedOutcome: "Schüler kennt Lösungsansätze.",
	});
});
