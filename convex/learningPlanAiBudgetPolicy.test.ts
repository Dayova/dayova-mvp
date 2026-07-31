import { describe, expect, test } from "vitest";
import {
	DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS,
	evaluateLearningPlanAiBudget,
	getUtcCalendarMonthRange,
} from "./learningPlanAiBudgetPolicy";

describe("learning plan AI budget policy", () => {
	test("uses UTC calendar months", () => {
		expect(
			getUtcCalendarMonthRange(Date.parse("2026-08-01T00:30:00+02:00")),
		).toEqual({
			start: Date.UTC(2026, 6, 1),
			end: Date.UTC(2026, 7, 1),
		});
	});

	test("switches to economy mode at the normal plan allowance", () => {
		const decision = evaluateLearningPlanAiBudget({
			monthlySpentUsdMicros: 50_000,
			monthlyReservedUsdMicros: 0,
			planSpentUsdMicros: 90_000,
			planReservedUsdMicros: 0,
			projectedCostUsdMicros: 10_000,
		});

		expect(decision).toMatchObject({
			allowed: true,
			economyMode: true,
			speculativeGenerationAllowed: true,
			planCommittedUsdMicros: 100_000,
		});
	});

	test("stops speculative work before the monthly hard limit", () => {
		const decision = evaluateLearningPlanAiBudget({
			monthlySpentUsdMicros: 2_850_000,
			monthlyReservedUsdMicros: 0,
			planSpentUsdMicros: 20_000,
			planReservedUsdMicros: 0,
			projectedCostUsdMicros: 1,
		});

		expect(decision).toMatchObject({
			allowed: true,
			economyMode: true,
			speculativeGenerationAllowed: false,
		});
	});

	test("blocks the plan and monthly hard limits independently", () => {
		const planDecision = evaluateLearningPlanAiBudget({
			monthlySpentUsdMicros: 0,
			monthlyReservedUsdMicros: 0,
			planSpentUsdMicros:
				DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS.planHardUsdMicros,
			planReservedUsdMicros: 0,
			projectedCostUsdMicros: 1,
		});
		const monthlyDecision = evaluateLearningPlanAiBudget({
			monthlySpentUsdMicros:
				DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS.monthlyHardUsdMicros,
			monthlyReservedUsdMicros: 0,
			planSpentUsdMicros: 0,
			planReservedUsdMicros: 0,
			projectedCostUsdMicros: 1,
		});

		expect(planDecision).toMatchObject({ allowed: false, blockReason: "plan" });
		expect(monthlyDecision).toMatchObject({
			allowed: false,
			blockReason: "monthly",
		});
	});
});
