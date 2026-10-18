import { describe, expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { ROUTES } from "~/lib/routes";
import { getLearningSessionCompletionDestination } from "./session-completion-navigation";

describe("getLearningSessionCompletionDestination", () => {
	test("preserves the learning plan context when returning to the learning plan", () => {
		const planId = "plan_1" as Id<"learningPlans">;

		expect(getLearningSessionCompletionDestination(planId)).toEqual({
			pathname: "/learning-plans/[planId]",
			params: { planId },
		});
	});

	test("falls back to the learning plan list without a learning plan", () => {
		expect(getLearningSessionCompletionDestination()).toBe(
			ROUTES.learningPlans,
		);
	});
});
