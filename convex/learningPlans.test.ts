/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
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
		time: "17:15",
		kind: "Hausaufgabe",
		plannedDateLabel: "31. Mai 2026",
		durationMinutes: 30,
	});

	await expect(
		t.mutation(api.learningPlans.addSession, { learningPlanId }),
	).rejects.toThrow(
		'Dieser Zeitraum überschneidet sich mit "Deutsch Hausaufgabe" am 31. Mai 2026 von 17:15 bis 17:45.',
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
	).resolves.toBeNull();
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

test("AI context includes occupied entries during the plan scheduling window", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-01",
		title: "Informatik Grundlagen IT-Systeme",
		time: "17:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "1. Juni 2026",
		durationMinutes: 30,
		examTypeLabel: "Test",
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
