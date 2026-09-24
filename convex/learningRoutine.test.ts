/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { computeLearningTimeImpact } from "./adaptiveLearningPlan";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("impact calculation is read-only and reserves non-overlapping slots", async () => {
	const { t, ids } = await fixture();
	const before = await t.run((ctx) =>
		ctx.db.get("learningPlanSessions", ids.session),
	);
	await t.run(async (ctx) => {
		if (!before) throw new Error("Missing fixture");
		const { _id, _creationTime, dayEntryId, ...data } = before;
		await ctx.db.insert("learningPlanSessions", {
			...data,
			sortOrder: 1,
			startTime: "17:30",
			planningStatus: "provisional",
		});
	});
	const impact = await t.run((ctx) =>
		computeLearningTimeImpact(
			ctx,
			"routine:owner",
			[{ dayOfWeek: 4, startTime: "18:00", endTime: "19:00" }],
			Date.now(),
		),
	);
	expect(impact.conflicts).toEqual([]);
	expect(impact.changes.map((change) => change.startTime)).toEqual([
		"18:00",
		"18:30",
	]);
	expect(
		await t.run((ctx) => ctx.db.get("learningPlanSessions", ids.session)),
	).toEqual(before);
	await expect(
		t.mutation(api.learningPlans.moveSessionToday, {
			sessionId: ids.session,
			startTime: "18:00",
			expectedUpdatedAt: 1,
		}),
	).rejects.toThrow();
});
afterEach(() => vi.useRealTimers());
async function fixture() {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
	const root = convexTest(schema, modules);
	const t = root.withIdentity({ tokenIdentifier: "routine:owner" });
	const ids = await t.run(async (ctx) => {
		await ctx.db.insert("users", {
			tokenIdentifier: "routine:owner",
			clerkId: "routine",
			email: "routine@example.com",
		});
		const plan = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "routine:owner",
			subject: "Mathe",
			examTypeLabel: "Test",
			examDateKey: "2026-10-01",
			examDateLabel: "1. Oktober",
			durationMinutes: 30,
			topicDescription: "Funktionen",
			status: "accepted",
			createdAt: 1,
			updatedAt: 1,
		});
		const session = await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier: "routine:owner",
			learningPlanId: plan,
			phase: "practice",
			title: "Funktionen üben",
			dateKey: "2026-09-24",
			dateLabel: "24. September",
			startTime: "17:00",
			durationMinutes: 30,
			goal: "Üben",
			tasks: [],
			expectedOutcome: "Verstehen",
			executionStatus: "notStarted",
			planningStatus: "committed",
			sortOrder: 0,
			createdAt: 1,
			updatedAt: 1,
		});
		const entry = await ctx.db.insert("dayEntries", {
			ownerTokenIdentifier: "routine:owner",
			dayKey: "2026-09-24",
			title: "Funktionen üben",
			kind: "Lernen",
			time: "17:00",
			durationMinutes: 30,
			relatedLearningPlanId: plan,
			relatedLearningPlanSessionId: session,
		});
		await ctx.db.patch("learningPlanSessions", session, { dayEntryId: entry });
		return { plan, session, entry };
	});
	return { root, t, ids };
}

test("home coaching is voluntary, owner scoped and dismissed for the current day", async () => {
	const { root, t } = await fixture();
	expect(
		(
			await t.query(api.learningTimes.getHomeRoutine, {
				referenceTime: Date.now(),
			})
		)?.session?.startTime,
	).toBe("17:00");
	expect(
		await root
			.withIdentity({ tokenIdentifier: "other" })
			.query(api.learningTimes.getHomeRoutine, { referenceTime: Date.now() }),
	).toBeNull();
	await t.mutation(api.learningTimes.dismissHomeRoutine, {});
	expect(
		await t.query(api.learningTimes.getHomeRoutine, {
			referenceTime: Date.now(),
		}),
	).toBeNull();
	expect(await t.query(api.learningTimes.listMine, {})).toEqual([]);
});

test("only today moves the calendar but preserves progress and regular times", async () => {
	const { t, ids } = await fixture();
	const before = await t.run((ctx) =>
		ctx.db.get("learningPlanSessions", ids.session),
	);
	await t.mutation(api.learningPlans.moveSessionToday, {
		sessionId: ids.session,
		startTime: "18:00",
		expectedUpdatedAt: 1,
	});
	const after = await t.run((ctx) =>
		ctx.db.get("learningPlanSessions", ids.session),
	);
	expect(after).toEqual({
		...before,
		startTime: "18:00",
		updatedAt: Date.now(),
	});
	expect(
		(await t.run((ctx) => ctx.db.get("dayEntries", ids.entry)))?.time,
	).toBe("18:00");
	expect(await t.query(api.learningTimes.listMine, {})).toEqual([]);
	expect(
		await t.query(api.learningTimes.getHomeRoutine, {
			referenceTime: Date.now(),
		}),
	).toBeNull();
});

test("only today rejects ownership, stale, past, midnight and already-started changes", async () => {
	const { root, t, ids } = await fixture();
	const args = {
		sessionId: ids.session,
		startTime: "18:00",
		expectedUpdatedAt: 1,
	};
	await expect(
		root
			.withIdentity({ tokenIdentifier: "other" })
			.mutation(api.learningPlans.moveSessionToday, args),
	).rejects.toThrow();
	for (const patch of [
		{ expectedUpdatedAt: 0 },
		{ startTime: "13:00" },
		{ startTime: "23:50" },
		{ startTime: "25:00" },
	])
		await expect(
			t.mutation(api.learningPlans.moveSessionToday, { ...args, ...patch }),
		).rejects.toThrow();
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", ids.session, {
			executionStatus: "started",
		}),
	);
	await expect(
		t.mutation(api.learningPlans.moveSessionToday, args),
	).rejects.toThrow();
});

test("only today refuses overlapping entries without modifying either session or calendar", async () => {
	const { t, ids } = await fixture();
	await t.run((ctx) =>
		ctx.db.insert("dayEntries", {
			ownerTokenIdentifier: "routine:owner",
			dayKey: "2026-09-24",
			title: "Hausaufgabe",
			kind: "Hausaufgabe",
			time: "18:00",
			durationMinutes: 30,
		}),
	);
	await expect(
		t.mutation(api.learningPlans.moveSessionToday, {
			sessionId: ids.session,
			startTime: "18:00",
			expectedUpdatedAt: 1,
		}),
	).rejects.toThrow();
	expect(
		(await t.run((ctx) => ctx.db.get("learningPlanSessions", ids.session)))
			?.startTime,
	).toBe("17:00");
	expect(
		(await t.run((ctx) => ctx.db.get("dayEntries", ids.entry)))?.time,
	).toBe("17:00");
});
