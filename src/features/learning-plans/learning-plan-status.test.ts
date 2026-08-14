import { describe, expect, test } from "vitest";
import {
	getLearningPlanStatus,
	type LearningPlanStatusInput,
} from "./learning-plan-status";

const plan = (
	overrides: Partial<LearningPlanStatusInput> = {},
): LearningPlanStatusInput => ({
	completedCount: 2,
	sessionCount: 2,
	...overrides,
});

describe("adaptive learning plan status", () => {
	test("does not call an exhausted adaptive plan finished while mastery is still developing", () => {
		expect(
			getLearningPlanStatus(
				plan({ rollingPlanEnabled: true, masteryStatus: "learning" }),
				"2026-08-14",
			),
		).toMatchObject({ label: "Wiederholen" });
	});

	test("calls an adaptive plan finished only after mastery is verified", () => {
		expect(
			getLearningPlanStatus(
				plan({ rollingPlanEnabled: true, masteryStatus: "mastered" }),
				"2026-08-14",
			),
		).toMatchObject({ label: "Fertig" });
	});
});
