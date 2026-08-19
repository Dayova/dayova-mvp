import { describe, expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { ROUTES } from "~/lib/routes";
import { getLearningSessionBackTarget } from "./session-navigation";

describe("getLearningSessionBackTarget", () => {
	const planId = "plan_1" as Id<"learningPlans">;

	test("returns to the screen that opened the learning session", () => {
		expect(getLearningSessionBackTarget(planId, ROUTES.analytics)).toBe(
			ROUTES.analytics,
		);
	});

	test("falls back to the related learning plan", () => {
		expect(getLearningSessionBackTarget(planId)).toBe("/learning-plans/plan_1");
	});

	test("rejects an external return destination", () => {
		expect(getLearningSessionBackTarget(planId, "https://example.com")).toBe(
			"/learning-plans/plan_1",
		);
	});

	test("falls back to the learning-plan list without route context", () => {
		expect(getLearningSessionBackTarget()).toBe(ROUTES.learningPlans);
	});
});
