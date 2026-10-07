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
test.each([
	["2026-10-06", true],
	["2026-12-28", false],
])("a crowded calendar on %s keeps preparation reachable", async (dayKey, expectsProposal) => {
	const { t, id } = await setup();
	await t.run(async (ctx) => {
		await ctx.db.insert("userLearningTimes", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			dayOfWeek: 1,
			startTime: "17:00",
			endTime: "18:00",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
		for (let index = 0; index < 501; index++)
			await ctx.db.insert("dayEntries", {
				ownerTokenIdentifier: identity.tokenIdentifier,
				dayKey,
				title: `Aufgabe ${index}`,
				kind: "Hausaufgabe",
			});
	});
	const schedule = await t.query(api.learningPlans.getPreparationSchedule, {
		learningPlanId: id,
		now: { dateKey: "2026-10-05", minutes: 840 },
	});
	expect(schedule).toMatchObject({ revision: 0, budgetMinutes: 60 });
	expect(schedule.slots.length > 0).toBe(expectsProposal);
	if (!expectsProposal) {
		await t.mutation(api.learningPlans.savePreparationSchedule, {
			learningPlanId: id,
			revision: schedule.revision,
			slots: [slot],
		});
		expect(
			(await t.query(api.learningPlans.getSnapshot, { id }))?.sessions,
		).toHaveLength(3);
	}
});
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
	vi.setSystemTime(Date.now() + 120_000);
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

test.each([
	[900, 15, 120],
	[999_999, 30, 105],
])("diagnostic caps %s submitted seconds, credits %s minutes once and leaves %s minutes", async (submittedSeconds, diagnosticMinutes, budgetMinutes) => {
	const { t, id, root } = await setup("diagnostic", "Klassenarbeit");
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 1,
		startTime: "17:00",
		endTime: "18:00",
	});
	const questions = Array.from({ length: 10 }, (_, i) => ({
		id: `q${i}`,
		prompt: `Löse ${i}+1.`,
		targetInsight: "Addition",
		topicId: "algebra",
		kind: "performance" as const,
		responseKind: "multipleChoice" as const,
		options: ["richtig", "falsch"],
		correctAnswer: "richtig",
		idealAnswer: "richtig",
		explanation: "Die erste Antwort ist richtig.",
		evidenceDimension: "understanding" as const,
		evaluationKeywords: ["richtig"],
	}));
	await t.run((ctx) =>
		ctx.db.patch("learningPlans", id, {
			status: "questionsReady",
			scopeConfirmedAt: Date.now(),
			knowledgeQuestions: questions,
		}),
	);
	const sessionId = await t.mutation(api.learningPlans.prepareDiagnostic, {
		learningPlanId: id,
	});
	await t.mutation(api.learningPlans.acceptDiagnostic, { learningPlanId: id });
	await t.mutation(api.learningPlans.startSession, { sessionId });
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	expect(content?.items).toHaveLength(10);
	for (const [i, item] of (content?.items ?? []).entries()) {
		await t.mutation(api.learningSessionContent.submitAnswer, {
			itemId: item.id,
			selectedChoiceId: item.choices?.find(
				(c) => c.text === (i < 9 ? "richtig" : "falsch"),
			)?.id,
		});
	}
	vi.setSystemTime(new Date("2026-10-05T12:10:00Z"));
	await t.mutation(api.learningPlans.checkpointStudyTime, {
		sessionId,
		activeStudySeconds: 600,
	});
	await expect(
		root
			.withIdentity({ tokenIdentifier: "other" })
			.mutation(api.learningPlans.checkpointStudyTime, {
				sessionId,
				activeStudySeconds: 600,
			}),
	).rejects.toThrow();
	vi.setSystemTime(new Date("2026-10-05T12:30:00Z"));
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId,
		outcome: "completed",
		activeStudySeconds: submittedSeconds,
	});
	const schedule = await t.query(api.learningPlans.getPreparationSchedule, {
		learningPlanId: id,
		now: { dateKey: "2026-10-05", minutes: 900 },
	});
	expect(schedule).toMatchObject({
		correctCount: 9,
		questionCount: 10,
		baseMinutes: 180,
		totalMinutes: 135,
		diagnosticMinutes,
		budgetMinutes,
	});
	expect(schedule.slots.reduce((n, s) => n + s.durationMinutes, 0)).toBe(
		budgetMinutes,
	);
	expect(
		(await t.run((ctx) => ctx.db.get("learningPlanSessions", sessionId)))
			?.activeStudySeconds,
	).toBe(diagnosticMinutes * 60);
	expect(
		(await t.query(api.learningPlans.getSnapshot, { id }))?.plan
			.targetStudyMinutes,
	).toBe(135);
	await expect(
		t.mutation(api.learningPlans.recordSessionOutcome, {
			sessionId,
			outcome: "completed",
			activeStudySeconds: submittedSeconds,
		}),
	).rejects.toThrow();
});

test("preparation has no proposals without personal times, even with a grade", async () => {
	const { t, id } = await setup();
	await t.run((ctx) =>
		ctx.db.insert("users", {
			tokenIdentifier: identity.tokenIdentifier,
			clerkId: "preparation",
			email: "test@example.com",
			grade: "8",
		}),
	);
	const schedule = await t.query(api.learningPlans.getPreparationSchedule, {
		learningPlanId: id,
		now: { dateKey: "2026-10-05", minutes: 840 },
	});
	expect(schedule.slots).toEqual([]);
	expect(await t.query(api.learningTimes.listMine, {})).toEqual([]);
});

test.each([
	"untouched",
	"started",
	"interrupted",
])("adding appointments preserves %s flexible steps", async (state) => {
	const { t, id } = await setup();
	const first = await t.mutation(api.learningPlans.startFlexiblePreparation, {
		learningPlanId: id,
	});
	if (state !== "untouched")
		await t.mutation(api.learningPlans.startSession, { sessionId: first });
	if (state === "interrupted")
		await t.mutation(api.learningPlans.recordSessionOutcome, {
			sessionId: first,
			outcome: "partiallyCompleted",
			activeStudySeconds: 120,
		});
	const before = await t.run((ctx) =>
		ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", id),
			)
			.take(500),
	);
	const schedule = await t.query(api.learningPlans.getPreparationSchedule, {
		learningPlanId: id,
		now: { dateKey: "2026-10-05", minutes: 840 },
	});
	expect(schedule.slots).toEqual([]);
	expect(schedule.budgetMinutes).toBe(0);
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: schedule.revision,
		slots: [slot],
	});
	for (const original of before) {
		const after = await t.run((ctx) =>
			ctx.db.get("learningPlanSessions", original._id),
		);
		expect(after).toMatchObject({
			unscheduled: true,
			preparationSlotId: "flexible",
			durationMinutes: original.durationMinutes,
		});
	}
	const afterSchedule = await t.query(
		api.learningPlans.getPreparationSchedule,
		{ learningPlanId: id, now: { dateKey: "2026-10-05", minutes: 840 } },
	);
	expect(afterSchedule.slots).toHaveLength(1);
});

test("deleted grouped calendar entries are recreated when a step is started", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const [entry] = await t.run((ctx) => ctx.db.query("dayEntries").take(10));
	await t.mutation(api.dayEntries.remove, { id: entry._id });
	const snapshot = await t.query(api.learningPlans.getSnapshot, { id });
	const first = snapshot?.sessions[0];
	if (!first) throw Error("Missing first step");
	await t.mutation(api.learningPlans.startSession, { sessionId: first.id });
	const entries = await t.run((ctx) => ctx.db.query("dayEntries").take(10));
	expect(entries).toHaveLength(1);
	expect(entries[0]._id).not.toBe(entry._id);
	expect(entries[0]).toMatchObject({
		durationMinutes: 30,
		executionStatus: "started",
		startedAt: Date.now(),
	});
	const sessions = await t.run((ctx) =>
		ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", id),
			)
			.take(10),
	);
	expect(
		sessions.every((session) => session.dayEntryId === entries[0]._id),
	).toBe(true);
});

test("moving the remainder skips a deleted historical calendar entry", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const first = (await t.query(api.learningPlans.getSnapshot, { id }))
		?.sessions[0];
	if (!first) throw Error("Missing first step");
	await t.mutation(api.learningPlans.startSession, { sessionId: first.id });
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: first.id,
		outcome: "completed",
	});
	const [entry] = await t.run((ctx) => ctx.db.query("dayEntries").take(10));
	await t.mutation(api.dayEntries.remove, { id: entry._id });
	const schedule = await t.query(api.learningPlans.getPreparationSchedule, {
		learningPlanId: id,
		now: { dateKey: "2026-10-05", minutes: 840 },
	});
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: schedule.revision,
		slots: [{ ...slot, dateKey: "2026-10-07", durationMinutes: 20 }],
	});
	const entries = await t.run((ctx) => ctx.db.query("dayEntries").take(10));
	expect(entries).toHaveLength(1);
	expect(entries[0]).toMatchObject({
		dayKey: "2026-10-07",
		durationMinutes: 20,
	});
	expect(
		await t.run((ctx) => ctx.db.get("learningPlanSessions", first.id)),
	).toMatchObject({ completed: true });
});

test("grouped calendar title and actual start/completion times survive repeated syncs", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const [initial] = await t.run((ctx) => ctx.db.query("dayEntries").take(10));
	const startedAt = Date.now();
	for (let i = 0; i < 3; i++) {
		const next = (
			await t.query(api.learningPlans.getSnapshot, { id })
		)?.sessions.find((s) => s.planningStatus === "committed" && !s.completed);
		if (!next) throw Error("Missing next step");
		await t.mutation(api.learningPlans.startSession, { sessionId: next.id });
		vi.setSystemTime(Date.now() + 60_000);
		await t.mutation(api.learningPlans.recordSessionOutcome, {
			sessionId: next.id,
			outcome: "completed",
		});
		const entry = await t.run((ctx) => ctx.db.get("dayEntries", initial._id));
		expect(entry).toMatchObject({ title: initial.title, startedAt });
	}
	const outcomeAt = Date.now();
	vi.setSystemTime(Date.now() + 60_000);
	await t.mutation(api.learningPlans.syncSessionsToCalendar, {
		learningPlanId: id,
	});
	expect(
		await t.run((ctx) => ctx.db.get("dayEntries", initial._id)),
	).toMatchObject({
		title: initial.title,
		startedAt,
		outcomeAt,
		completed: true,
	});
});

test("interrupted groups retain their start time while all steps are idle", async () => {
	const { t, id } = await setup();
	await t.mutation(api.learningPlans.savePreparationSchedule, {
		learningPlanId: id,
		revision: 0,
		slots: [slot],
	});
	const first = (await t.query(api.learningPlans.getSnapshot, { id }))
		?.sessions[0];
	if (!first) throw Error("Missing first step");
	const startedAt = Date.now();
	await t.mutation(api.learningPlans.startSession, { sessionId: first.id });
	vi.setSystemTime(Date.now() + 60_000);
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: first.id,
		outcome: "partiallyCompleted",
	});
	const [entry] = await t.run((ctx) => ctx.db.query("dayEntries").take(10));
	expect(entry.startedAt).toBe(startedAt);
	expect(entry.outcomeAt).toBeUndefined();
});

test.each([
	[undefined, 0, 0],
	[60_000, 0, 0],
	[-60_000, 0, 60],
	[-60_000, 120, 120],
])("outcome caps submitted time for start offset %s and preserves %s recorded seconds", async (offset, previous, expected) => {
	const { t, id } = await setup();
	const sessionId = await t.mutation(
		api.learningPlans.startFlexiblePreparation,
		{ learningPlanId: id },
	);
	await t.mutation(api.learningPlans.startSession, { sessionId });
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", sessionId, {
			startedAt: offset === undefined ? undefined : Date.now() + offset,
			activeStudySeconds: previous,
		}),
	);
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId,
		outcome: "partiallyCompleted",
		activeStudySeconds: 999_999,
	});
	expect(
		await t.run((ctx) => ctx.db.get("learningPlanSessions", sessionId)),
	).toMatchObject({ activeStudySeconds: expected });
});

test("flexible budget counts only open required steps and clamps to zero", async () => {
	const { t, id } = await setup();
	const first = await t.mutation(api.learningPlans.startFlexiblePreparation, {
		learningPlanId: id,
	});
	await t.mutation(api.learningPlans.startSession, { sessionId: first });
	await t.mutation(api.learningPlans.recordSessionOutcome, {
		sessionId: first,
		outcome: "completed",
	});
	const args = {
		learningPlanId: id,
		now: { dateKey: "2026-10-05", minutes: 840 },
	};
	expect(
		(await t.query(api.learningPlans.getPreparationSchedule, args))
			.budgetMinutes,
	).toBe(10);
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", first, {
			additionalPractice: true,
			preparationSlotId: undefined,
			completed: false,
		}),
	);
	expect(
		(await t.query(api.learningPlans.getPreparationSchedule, args))
			.budgetMinutes,
	).toBe(10);
	const open = await t.run((ctx) =>
		ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", id),
			)
			.take(500),
	);
	const flexible = open.find((s) => s.preparationSlotId === "flexible");
	if (!flexible) throw Error("Missing flexible step");
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", flexible._id, {
			durationMinutes: 240,
		}),
	);
	expect(
		(await t.query(api.learningPlans.getPreparationSchedule, args))
			.budgetMinutes,
	).toBe(0);
});
