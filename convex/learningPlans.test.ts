/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
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
