import { describe, expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { ROUTES } from "~/lib/routes";
import { getLearningSessionAnalysisDestination } from "./session-analysis-navigation";

describe("getLearningSessionAnalysisDestination", () => {
	test("preserves the learning plan context when opening Analyse", () => {
		const planId = "plan_1" as Id<"learningPlans">;

		expect(getLearningSessionAnalysisDestination(planId)).toEqual({
			pathname: ROUTES.analytics,
			params: { planId },
		});
	});

	test("falls back to the Analyse root without a learning plan", () => {
		expect(getLearningSessionAnalysisDestination()).toBe(ROUTES.analytics);
	});
});
