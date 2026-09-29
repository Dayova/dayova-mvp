/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = { tokenIdentifier: "next-step:owner" };
const args = {
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
