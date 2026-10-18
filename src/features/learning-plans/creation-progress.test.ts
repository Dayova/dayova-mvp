import { describe, expect, test } from "vitest";
import {
	getExamEntryCreationProgress,
	getSafeLearningPlanCreationProgress,
} from "./creation-progress";

describe("learning-plan creation progress", () => {
	test("maps exam entry screens to their creation steps", () => {
		expect(
			(["examType", "examDetails", "basics"] as const).map(
				getExamEntryCreationProgress,
			),
		).toEqual([1, 1.5, 2]);
	});

	test("normalizes non-finite progress for visual and accessible output", () => {
		expect(
			getSafeLearningPlanCreationProgress({
				currentStep: Number.NaN,
				totalSteps: Number.POSITIVE_INFINITY,
			}),
		).toEqual({ currentStep: 1, totalSteps: 5 });
	});
});
