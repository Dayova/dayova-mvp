/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type TestBackend = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

const user = { tokenIdentifier: "test:ai-budget-user" };

const createPlan = async (t: TestBackend, suffix: string) => {
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-09-05",
		title: `Mathe Klausur ${suffix}`,
		time: "09:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "5. September 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});

	return await t.mutation(api.learningPlans.start, {
		examDayEntryId,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-09-05",
		examDateLabel: "5. September 2026",
		examTime: "09:00",
		durationMinutes: 90,
		topicDescription: `Lineare Funktionen ${suffix}`,
	});
};

const reserve = (
	t: TestBackend,
	learningPlanId: Id<"learningPlans">,
	reservationId: string,
	projectedCostUsdMicros: number,
) =>
	t.mutation(internal.learningPlanAiUsage.reserve, {
		learningPlanId,
		reservationId,
		operation: "plan",
		modelId: "gemini-3-flash-preview",
		projectedCostUsdMicros,
	});

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

test("serializes concurrent reservations at the lifetime plan cap", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t, "concurrent-plan");

	const reservations = await Promise.allSettled([
		reserve(t, learningPlanId, "plan-concurrent-a", 100_000),
		reserve(t, learningPlanId, "plan-concurrent-b", 100_000),
	]);

	expect(
		reservations.filter((result) => result.status === "fulfilled"),
	).toHaveLength(1);
	expect(
		reservations.filter((result) => result.status === "rejected"),
	).toHaveLength(1);
});

test("serializes reservations across plans at the monthly cap", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const seedPlanId = await createPlan(t, "monthly-seed");
	const firstPlanId = await createPlan(t, "monthly-a");
	const secondPlanId = await createPlan(t, "monthly-b");
	await t.run(async (ctx) => {
		await ctx.db.insert("learningPlanAiUsage", {
			ownerTokenIdentifier: user.tokenIdentifier,
			learningPlanId: seedPlanId,
			operation: "plan",
			modelId: "gemini-3-flash-preview",
			inputTokens: 0,
			cachedInputTokens: 0,
			outputTokens: 0,
			estimatedCostUsdMicros: 2_850_000,
			budgetCostUsdMicros: 2_850_000,
			accountingKind: "measured",
			createdAt: Date.now(),
		});
	});

	const reservations = await Promise.allSettled([
		reserve(t, firstPlanId, "monthly-concurrent-a", 100_000),
		reserve(t, secondPlanId, "monthly-concurrent-b", 100_000),
	]);

	expect(
		reservations.filter((result) => result.status === "fulfilled"),
	).toHaveLength(1);
	expect(
		reservations.filter((result) => result.status === "rejected"),
	).toHaveLength(1);
});

test("settles measured usage once and releases unused reservation", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t, "settlement");
	await reserve(t, learningPlanId, "settlement-reservation", 20_000);

	const settlement = {
		reservationId: "settlement-reservation",
		inputTokens: 2_000,
		cachedInputTokens: 500,
		outputTokens: 1_000,
		estimatedCostUsdMicros: 7_000,
	};
	const firstUsageId = await t.mutation(
		internal.learningPlanAiUsage.settle,
		settlement,
	);
	const secondUsageId = await t.mutation(
		internal.learningPlanAiUsage.settle,
		settlement,
	);
	const summary = await t.query(api.learningPlanAiUsage.getPlanCostSummary, {
		learningPlanId,
	});

	expect(secondUsageId).toBe(firstUsageId);
	expect(summary).toMatchObject({
		requestCount: 1,
		estimatedCostUsdMicros: 7_000,
		budgetCostUsdMicros: 7_000,
	});
	await expect(
		reserve(t, learningPlanId, "released-headroom", 143_000),
	).resolves.toBeTruthy();
});

test("charges projected cost once when provider outcome is unknown", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t, "forfeit");
	await reserve(t, learningPlanId, "failed-reservation", 25_000);

	const firstUsageId = await t.mutation(internal.learningPlanAiUsage.forfeit, {
		reservationId: "failed-reservation",
	});
	const secondUsageId = await t.mutation(internal.learningPlanAiUsage.forfeit, {
		reservationId: "failed-reservation",
	});
	const summary = await t.query(api.learningPlanAiUsage.getPlanCostSummary, {
		learningPlanId,
	});

	expect(secondUsageId).toBe(firstUsageId);
	expect(summary).toMatchObject({
		requestCount: 1,
		estimatedCostUsdMicros: 25_000,
		budgetCostUsdMicros: 25_000,
	});
});

test("keeps monthly usage after a learning plan is deleted", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t, "deletion");
	await reserve(t, learningPlanId, "deletion-reservation", 10_000);
	await t.mutation(internal.learningPlanAiUsage.settle, {
		reservationId: "deletion-reservation",
		inputTokens: 1_000,
		cachedInputTokens: 0,
		outputTokens: 1_000,
		estimatedCostUsdMicros: 5_000,
	});

	await t.mutation(api.learningPlans.removePlan, { id: learningPlanId });
	const summary = await t.query(
		api.learningPlanAiUsage.getMyMonthlyCostSummary,
		{ monthStart: Date.UTC(2026, 6, 1) },
	);

	expect(summary).toMatchObject({
		planCount: 1,
		requestCount: 1,
		budgetCostUsdMicros: 5_000,
	});
});

test("resets monthly accounting at the UTC month boundary", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t, "month-rollover");
	await reserve(t, learningPlanId, "july-reservation", 10_000);
	await t.mutation(internal.learningPlanAiUsage.settle, {
		reservationId: "july-reservation",
		inputTokens: 1_000,
		cachedInputTokens: 0,
		outputTokens: 1_000,
		estimatedCostUsdMicros: 5_000,
	});
	vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));

	const august = await t.query(
		api.learningPlanAiUsage.getMyMonthlyCostSummary,
		{ monthStart: Date.UTC(2026, 7, 1) },
	);

	expect(august).toMatchObject({ requestCount: 0, budgetCostUsdMicros: 0 });
});

test("forfeits a stale plan reservation from the previous month", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t, "stale-rollover");
	await reserve(t, learningPlanId, "stale-july-reservation", 20_000);
	vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));

	await expect(
		reserve(t, learningPlanId, "august-after-stale", 130_000),
	).resolves.toBeTruthy();
	const july = await t.query(api.learningPlanAiUsage.getMyMonthlyCostSummary, {
		monthStart: Date.UTC(2026, 6, 1),
	});

	expect(july).toMatchObject({ requestCount: 1, budgetCostUsdMicros: 20_000 });
});
