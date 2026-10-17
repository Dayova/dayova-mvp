/// <reference types="vite/client" />

import { runToCompletion } from "@convex-dev/migrations";
import migrationsTest from "@convex-dev/migrations/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { getBerlinDayKey } from "./dayKeyVariants";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = { tokenIdentifier: "next-step:owner" };
const args = {
	useDayIndex: true,
	todayKey: "2026-09-29",
	paginationOpts: { numItems: 2, cursor: null },
};

async function setup() {
	const t = convexTest(schema, modules);
	const planId = await t.run((ctx) =>
		ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			subject: "Mathematik",
			examTypeLabel: "Test",
			examDateKey: "2027-06-01",
			examDateLabel: "1. Juni",
			durationMinutes: 30,
			topicDescription: "Gleichungen",
			status: "accepted",
			createdAt: 1,
			updatedAt: 1,
		}),
	);
	const insert = (overrides: Partial<Doc<"learningPlanSessions">> = {}) =>
		t.run((ctx) =>
			ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: identity.tokenIdentifier,
				learningPlanId: planId,
				phase: "practice",
				title: "Gleichungen lösen",
				dateKey: "2027-03-01",
				dateLabel: "1. März",
				startTime: "17:00",
				durationMinutes: 17,
				goal: "Übe Gleichungen.",
				tasks: [],
				expectedOutcome: "Sicher lösen",
				sortOrder: 1,
				createdAt: 1,
				updatedAt: 1,
				...overrides,
				berlinDayKey: getBerlinDayKey(overrides.dateKey ?? "2027-03-01"),
			}),
		);
	return { t, owner: t.withIdentity(identity), planId, insert };
}

test("finds sessions months ahead without a calendar-day horizon and reacts to completion", async () => {
	const { owner, t, insert } = await setup();
	const id = await insert();
	let result = await owner.query(api.dashboardNextStep.listCandidates, args);
	expect(result.page[0].step).toMatchObject({
		dayKey: "2027-03-01",
		subject: "Mathematik",
		session: { _id: id },
	});
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", id, { executionStatus: "completed" }),
	);
	result = await owner.query(api.dashboardNextStep.listCandidates, args);
	expect(result.page.every((row) => row.step === null)).toBe(true);
	expect(result.isDone).toBe(true);
});

test("keeps legacy full-scan clients working and gates the indexed path until backfilled", async () => {
	const { owner, t, insert } = await setup();
	const id = await insert({ dateKey: "2026-09-28T22:00:00.000Z" });
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", id, { berlinDayKey: undefined }),
	);
	expect(await owner.query(api.dashboardNextStep.isDayIndexReady, {})).toBe(
		false,
	);
	const legacy = await owner.query(api.dashboardNextStep.listCandidates, {
		todayKey: args.todayKey,
		paginationOpts: args.paginationOpts,
	});
	expect(legacy.page[0].step?.session._id).toBe(id);
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", id, { berlinDayKey: args.todayKey }),
	);
	expect(await owner.query(api.dashboardNextStep.isDayIndexReady, {})).toBe(
		true,
	);
	expect(
		(await owner.query(api.dashboardNextStep.listCandidates, args)).page[0]
			.scanDateKey,
	).toBe(args.todayKey);
});

test("continues through skipped pages instead of claiming there is no next step", async () => {
	const { owner, insert } = await setup();
	await insert({ dateKey: "2026-09-29", completed: true });
	await insert({ dateKey: "2026-09-30", executionStatus: "completed" });
	await insert({ dateKey: "2026-10-01", planningStatus: "provisional" });
	const id = await insert();
	const first = await owner.query(api.dashboardNextStep.listCandidates, args);
	expect(first.page.every((row) => row.step === null)).toBe(true);
	expect(first.isDone).toBe(false);
	const second = await owner.query(api.dashboardNextStep.listCandidates, {
		...args,
		paginationOpts: { numItems: 2, cursor: first.continueCursor },
	});
	expect(second.page.find((row) => row.step)?.step?.session._id).toBe(id);
});

test("keeps today's overdue open step and normalizes legacy Berlin-midnight dates", async () => {
	const { owner, insert } = await setup();
	await insert({ dateKey: "2026-09-28", startTime: "08:00" });
	const id = await insert({
		dateKey: "2026-09-28T22:00:00.000Z",
		startTime: "08:00",
		executionStatus: "started",
	});
	const result = await owner.query(api.dashboardNextStep.listCandidates, args);
	expect(result.page.filter((row) => row.step)).toHaveLength(1);
	expect(result.page.find((row) => row.step)?.step).toMatchObject({
		dayKey: "2026-09-29",
		session: { _id: id, executionStatus: "started" },
	});
});

test("requires authentication and isolates both session and plan ownership", async () => {
	const { t, owner, insert, planId } = await setup();
	await insert();
	await expect(
		t.query(api.dashboardNextStep.listCandidates, args),
	).rejects.toThrow("Nicht authentifiziert");
	const stranger = t.withIdentity({ tokenIdentifier: "next-step:other" });
	expect(
		(await stranger.query(api.dashboardNextStep.listCandidates, args)).page,
	).toEqual([]);
	await t.run((ctx) =>
		ctx.db.patch("learningPlans", planId, {
			ownerTokenIdentifier: "next-step:other",
		}),
	);
	expect(
		(await owner.query(api.dashboardNextStep.listCandidates, args)).page[0]
			.step,
	).toBeNull();
});

test("keeps offset dates whose raw key precedes the Berlin-midnight lower bound", async () => {
	const { owner, insert } = await setup();
	const id = await insert({ dateKey: "2026-10-04T12:00:00-12:00" });
	const result = await owner.query(api.dashboardNextStep.listCandidates, {
		...args,
		todayKey: "2026-10-05",
	});
	expect(result.page.find((row) => row.step)?.step).toMatchObject({
		dayKey: "2026-10-05",
		session: { _id: id },
	});
});

test("excludes unaccepted plans and supports legacy completion flags", async () => {
	const { t, owner, insert, planId } = await setup();
	await insert({ completed: true });
	await insert({ completed: true, executionStatus: "started" });
	let result = await owner.query(api.dashboardNextStep.listCandidates, args);
	expect(result.page.filter((row) => row.step)).toHaveLength(1);
	await t.run((ctx) =>
		ctx.db.patch("learningPlans", planId, { status: "draft" }),
	);
	result = await owner.query(api.dashboardNextStep.listCandidates, args);
	expect(result.page.every((row) => row.step === null)).toBe(true);
});

test("returns an exhausted empty result only when there are no future sessions", async () => {
	const { owner } = await setup();
	expect(
		await owner.query(api.dashboardNextStep.listCandidates, args),
	).toMatchObject({ page: [], isDone: true });
});

test("does not page through 320 past sessions before reaching today's step", async () => {
	const { owner, insert } = await setup();
	for (let i = 0; i < 320; i++)
		await insert({ dateKey: "2026-01-01", completed: true });
	const id = await insert({ dateKey: args.todayKey });
	const result = await owner.query(api.dashboardNextStep.listCandidates, args);
	expect(result.page.find((row) => row.step)?.step?.session._id).toBe(id);
});

test("backfills legacy offsets and invalid dates idempotently in multiple batches", async () => {
	const { t, owner, insert } = await setup();
	migrationsTest.register(t);
	const ids = [];
	for (let i = 0; i < 105; i++) {
		const id = await insert({
			dateKey: i === 0 ? "invalid" : "2026-09-28T22:00:00.000Z",
		});
		await t.run((ctx) =>
			ctx.db.patch("learningPlanSessions", id, { berlinDayKey: undefined }),
		);
		ids.push(id);
	}
	expect(await owner.query(api.dashboardNextStep.isDayIndexReady, {})).toBe(
		false,
	);
	await t.run((ctx) =>
		runToCompletion(
			ctx,
			components.migrations,
			internal.dashboardMigrations.backfillBerlinDayKeys,
		),
	);
	expect(await owner.query(api.dashboardNextStep.isDayIndexReady, {})).toBe(
		true,
	);
	for (const [i, id] of ids.entries()) {
		const session = await t.run((ctx) =>
			ctx.db.get("learningPlanSessions", id),
		);
		expect(session?.berlinDayKey).toBe(i === 0 ? null : args.todayKey);
	}
	await t.run((ctx) =>
		runToCompletion(
			ctx,
			components.migrations,
			internal.dashboardMigrations.backfillBerlinDayKeys,
		),
	);
	expect(await owner.query(api.dashboardNextStep.isDayIndexReady, {})).toBe(
		true,
	);
});

test("a rescheduled session updates the day index in the same mutation", async () => {
	const { owner, t, insert } = await setup();
	const id = await insert();
	await owner.mutation(api.learningPlans.updateSession, {
		id,
		phase: "practice",
		dateKey: "2026-09-28T22:00:00.000Z",
		dateLabel: "29. September",
		startTime: "17:00",
		durationMinutes: 17,
	});
	expect(
		(await t.run((ctx) => ctx.db.get("learningPlanSessions", id)))
			?.berlinDayKey,
	).toBe(args.todayKey);
});
