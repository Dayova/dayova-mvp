/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = { tokenIdentifier: "test:preparation" };
const topic = {
	id: "algebra",
	title: "Gleichungen",
	learningGoal: "Gleichungen lösen",
	keywords: ["Gleichungen"],
	priority: "high" as const,
};
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
async function setup(
	state: "diagnostic" | "review" = "review",
	examTypeLabel = "Test",
) {
	const root = convexTest(schema, modules);
	const t = root.withIdentity(identity);
	const id = await t.run(
		async (ctx) =>
			await ctx.db.insert("learningPlans", {
				ownerTokenIdentifier: identity.tokenIdentifier,
				subject: "Mathe",
				examTypeLabel,
				examDateKey: "2026-12-31",
				examDateLabel: "31. Dezember",
				durationMinutes: 60,
				topicDescription: "Lineare Gleichungen",
				topicMap: [topic],
				status: "accepted",
				preparationState: state,
				preparationRevision: 0,
				rollingPlanEnabled: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
	);
	return { t, id, root };
}
const slot = {
	id: "slot-1",
	dateKey: "2026-10-06",
	startTime: "17:00",
	durationMinutes: 30,
};
test("schedule is atomic, has one calendar event and three small steps", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const result = await t.query(api.learningPlans.getSnapshot, { id });
	expect(result?.sessions.map((s) => s.durationMinutes)).toEqual([10, 10, 10]);
	expect(
		result?.sessions.filter((s) => s.planningStatus === "committed"),
	).toHaveLength(1);
	const entries = await t.run((ctx) => ctx.db.query("dayEntries").take(1000));
	expect(entries).toHaveLength(1);
	expect(entries[0].durationMinutes).toBe(30);
	expect(
		await t.run((ctx) => ctx.db.query("userLearningTimes").take(1000)),
	).toHaveLength(0);
});
test("other owners cannot inspect or adopt a schedule", async () => {
	const { id, root } = await setup();
	const other = root.withIdentity({ tokenIdentifier: "test:other" });
	await expect(
		other.mutation(api.learningPlans.savePreparationSchedule, {
			learningPlanId: id,
			revision: 0,
			slots: [slot],
		}),
	).rejects.toThrow("nicht gefunden");
});
test("competing plans cannot book the same time", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const second = await t.run(async (ctx) => {
		const p = await ctx.db.get("learningPlans", id);
		if (!p) throw Error();
		const { _id, _creationTime, ...fields } = p;
		return ctx.db.insert("learningPlans", {
			...fields,
			preparationState: "review",
			preparationRevision: 0,
		});
	});
	await expect(
		t.mutation(api.learningPlans.savePreparationSchedule, {
			learningPlanId: second,
			revision: 0,
			slots: [slot],
		}),
	).rejects.toThrow("überschneidet");
	expect(
		await t.run((ctx) =>
			ctx.db
				.query("learningPlanSessions")
				.withIndex("by_learningPlanId_and_sortOrder", (q) =>
					q.eq("learningPlanId", second),
				)
				.take(1000),
		),
	).toHaveLength(0);
});
test("shorter accepted availability retains full fixed budget and can be edited without duplicate entries", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 1,
		slots: [{ ...slot, startTime: "18:00", durationMinutes: 20 }],
	});
	const entries = await t.run((ctx) => ctx.db.query("dayEntries").take(1000));
	expect(entries).toHaveLength(1);
	expect(entries[0].time).toBe("18:00");
	expect(entries[0].durationMinutes).toBe(20);
	await expect(
		t.mutation(api.learningPlans.savePreparationSchedule, {
			learningPlanId: id,
			revision: 1,
			slots: [slot],
		}),
	).rejects.toThrow("inzwischen");
});
test("early completion counts once, preserves group event and stops after last required step", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	for (let i = 0; i < 3; i++) {
		const snap = await t.query(api.learningPlans.getSnapshot, { id });
		const next = snap?.sessions.find(
			(s) => s.planningStatus === "committed" && !s.completed,
		);
		if (!next) throw Error("Missing next step");
		await t.mutation(api.learningPlans.startSession, { sessionId: next.id });
		await t.mutation(api.learningPlans.recordSessionOutcome, {
			sessionId: next.id,
			outcome: "completed",
			activeStudySeconds: 60,
		});
		await expect(
			t.mutation(api.learningPlans.recordSessionOutcome, {
				sessionId: next.id,
				outcome: "completed",
			}),
		).rejects.toThrow();
		const entries = await t.run((ctx) => ctx.db.query("dayEntries").take(1000));
		expect(entries).toHaveLength(1);
	}
	const snap = await t.query(api.learningPlans.getSnapshot, { id });
	expect(snap?.plan.preparationState).toBe("completed");
	expect(snap?.sessions).toHaveLength(3);
	const extra = await t.mutation(api.learningPlans.createAdditionalPractice, {
		learningPlanId: id,
		topicId: "algebra",
		durationMinutes: 10,
	});
	expect(
		await t.mutation(api.learningPlans.createAdditionalPractice, {
			learningPlanId: id,
			topicId: "algebra",
			durationMinutes: 10,
		}),
	).toBe(extra);
	expect(
		(await t.query(api.learningPlans.getSnapshot, { id }))?.plan
			.preparationState,
	).toBe("completed");
	expect(
		await t.run((ctx) => ctx.db.query("dayEntries").take(1000)),
	).toHaveLength(1);
});

test("missed and partial steps remain resumable and remaining part of a day can move", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	let snap = await t.query(api.learningPlans.getSnapshot, { id });
	const first = snap?.sessions[0];
	if (!first) throw Error();
	await t.mutation(api.learningPlans.missSession, {
		sessionId: first.id,
		reason: "no_time",
	});
	await t.mutation(api.learningPlans.startSession, { sessionId: first.id });
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: first.id,
		outcome: "partiallyCompleted",
	});
	await t.mutation(api.learningPlans.startSession, { sessionId: first.id });
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: first.id,
		outcome: "completed",
	});
	const schedule = await t.query(api.learningPlans.getPreparationSchedule, {
		learningPlanId: id,
		now: { dateKey: "2026-10-05", minutes: 840 },
	});
	expect(schedule.slots[0]).toMatchObject({
		durationMinutes: 20,
		completedMinutes: 10,
		locked: false,
		startTime: "17:10",
	});
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: schedule.revision,
		slots: [{ ...slot, dateKey: "2026-10-07", durationMinutes: 20 }],
	});
	snap = await t.query(api.learningPlans.getSnapshot, { id });
	expect(snap?.sessions.filter((s) => s.completed)).toHaveLength(1);
	expect(
		snap?.sessions
			.filter((s) => !s.completed)
			.every((s) => s.dateKey === "2026-10-07"),
	).toBe(true);
	const entries = await t.run((ctx) => ctx.db.query("dayEntries").take(1000));
	expect(entries).toHaveLength(2);
	expect(entries.filter((e) => e.completed)).toHaveLength(1);
});
test("legacy individual APIs cannot corrupt a grouped slot", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const snap = await t.query(api.learningPlans.getSnapshot, { id });
	const first = snap?.sessions[0];
	if (!first) throw Error();
	await expect(
		t.mutation(api.learningPlans.removeSession, { id: first.id }),
	).rejects.toThrow("Termine");
	await expect(
		t.mutation(api.learningPlans.updateSession, {
			id: first.id,
			phase: "practice",
			dateKey: "2026-10-08",
			dateLabel: "8. Oktober",
			startTime: "18:00",
			durationMinutes: 10,
		}),
	).rejects.toThrow("Termine");
});
test("calendar projection does not manufacture duplicate step rows", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const snap = await t.query(api.learningPlans.getSnapshot, { id });
	const first = snap?.sessions[0];
	if (!first) throw Error();
	await t.mutation(api.learningPlans.startSession, { sessionId: first.id });
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: first.id,
		outcome: "completed",
	});
	const grouped = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: [slot.dateKey],
	});
	expect(grouped[slot.dateKey]).toHaveLength(1);
});
test("deleting an Abitur plan cleans all 180 steps and calendar groups", async () => {
	const { t, id, root } = await setup("review", "Abitur");
	const slots = Array.from({ length: 60 }, (_, i) => {
		const date = new Date("2026-10-06T12:00:00Z");
		date.setUTCDate(date.getUTCDate() + i);
		return {
			...slot,
			id: `abi-${i}`,
			dateKey: date.toISOString().slice(0, 10),
		};
	});
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots,
	});
	expect(
		(await t.query(api.learningPlans.getSnapshot, { id }))?.sessions,
	).toHaveLength(180);
	await t.mutation(api.learningPlans.removePlan, { id });
	await root.finishAllScheduledFunctions(vi.runAllTimers);
	expect(
		await t.run((ctx) => ctx.db.query("learningPlanSessions").take(1000)),
	).toHaveLength(0);
	expect(
		await t.run((ctx) => ctx.db.query("dayEntries").take(1000)),
	).toHaveLength(0);
});

test("same-day exam can start the full fixed preparation without calendar availability", async () => {
	const { t, id } = await setup();
	await t.run((ctx) =>
		ctx.db.patch("learningPlans", id, { examDateKey: "2026-10-05" }),
	);
	const next = await t.mutation(api.learningPlans.startFlexiblePreparation, {
		learningPlanId: id,
	});
	const snapshot = await t.query(api.learningPlans.getSnapshot, { id });
	expect(
		snapshot?.sessions.reduce((sum, s) => sum + s.durationMinutes, 0),
	).toBe(60);
	expect(snapshot?.sessions.every((s) => s.unscheduled)).toBe(true);
	expect(
		snapshot?.sessions.find((s) => s.planningStatus === "committed")?.id,
	).toBe(next);
	expect(
		await t.run((ctx) => ctx.db.query("dayEntries").take(1000)),
	).toHaveLength(0);
	await t.mutation(api.learningPlans.startSession, { sessionId: next });
});
test("moving a later slot earlier reconciles exactly one committed next step", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot, { ...slot, id: "second", dateKey: "2026-10-08" }],
	});
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 1,
		slots: [
			slot,
			{ ...slot, id: "second", dateKey: "2026-10-05", startTime: "18:00" },
		],
	});
	const snapshot = await t.query(api.learningPlans.getSnapshot, { id });
	expect(
		snapshot?.sessions.filter((s) => s.planningStatus === "committed"),
	).toHaveLength(1);
	expect(snapshot?.sessions[0].dateKey).toBe("2026-10-05");
	expect(snapshot?.sessions[0].planningStatus).toBe("committed");
});

test("completed history plus new appointments cannot exceed the lifecycle read bound", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	await t.run(async (ctx) => {
		const existing = await ctx.db.query("learningPlanSessions").first();
		if (!existing) throw Error();
		const { _id, _creationTime, ...fields } = existing;
		for (let i = 0; i < 150; i++)
			await ctx.db.insert("learningPlanSessions", {
				...fields,
				preparationSlotId: "historical",
				dayEntryId: undefined,
				unscheduled: true,
				completed: true,
				executionStatus: "completed",
				sortOrder: i + 5,
			});
	});
	const slots = Array.from({ length: 30 }, (_, i) => ({
		...slot,
		id: `large-${i}`,
		dateKey: `2026-11-${String(i + 1).padStart(2, "0")}`,
		durationMinutes: 120,
	}));
	await expect(
		t.mutation(api.learningPlans.savePreparationSchedule, {
			learningPlanId: id,
			revision: 1,
			slots,
		}),
	).rejects.toThrow("weniger zusätzliche Zeit");
	expect(
		(await t.query(api.learningPlans.getSnapshot, { id }))?.sessions,
	).toHaveLength(153);
});

test("moving an interrupted step preserves its identity, study time and learning data", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const snapshot = await t.query(api.learningPlans.getSnapshot, { id });
	const first = snapshot?.sessions[0];
	if (!first) throw Error();
	await t.mutation(api.learningPlans.startSession, { sessionId: first.id });
	const saved = await t.run(async (ctx) => {
		const itemId = await ctx.db.insert("learningSessionContentItems", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: id,
			sessionId: first.id,
			phase: "practice",
			kind: "written",
			title: "Gleichung",
			prompt: "x+2=5",
			explanation: "Subtrahiere 2.",
			idealAnswer: "3",
			evaluationKeywords: ["3"],
			sortOrder: 0,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
		const attemptId = await ctx.db.insert("learningSessionAnswerAttempts", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: id,
			sessionId: first.id,
			itemId,
			answerText: "3",
			rating: "correct",
			feedback: "Richtig",
			perfectAnswer: "3",
			createdAt: Date.now(),
		});
		return { itemId, attemptId };
	});
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: first.id,
		outcome: "partiallyCompleted",
		activeStudySeconds: 120,
	});
	const before = await t.run((ctx) =>
		ctx.db.get("learningPlanSessions", first.id),
	);
	const revision = (
		await t.query(api.learningPlans.getPreparationSchedule, {
			learningPlanId: id,
			now: { dateKey: "2026-10-05", minutes: 840 },
		})
	).revision;
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision,
		slots: [{ ...slot, dateKey: "2026-10-07" }],
	});
	const after = await t.run((ctx) =>
		ctx.db.get("learningPlanSessions", first.id),
	);
	expect(
		await t.run((ctx) =>
			ctx.db.get("learningSessionContentItems", saved.itemId),
		),
	).not.toBeNull();
	expect(
		await t.run((ctx) =>
			ctx.db.get("learningSessionAnswerAttempts", saved.attemptId),
		),
	).toMatchObject({ answerText: "3" });
	expect(after).toMatchObject({
		activeStudySeconds: 120,
		dateKey: "2026-10-07",
		planningStatus: "committed",
		targetTopicIds: before?.targetTopicIds,
	});
});
