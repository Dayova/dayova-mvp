import { describe, expect, test } from "vitest";
import {
	getExamEntryCreationProgress,
	getLearningPlanCreationProgressPercentage,
	getSafeLearningPlanCreationProgress,
} from "./creation-progress";

describe("learning-plan creation progress", () => {
	test("turns intermediate progress into a changing percentage", () => {
		expect(
			(["examType", "examDetails", "basics"] as const)
				.map(getExamEntryCreationProgress)
				.map(getLearningPlanCreationProgressPercentage),
		).toEqual([20, 30, 40]);
	});

	test("normalizes non-finite progress for visual and accessible output", () => {
		expect(
			getSafeLearningPlanCreationProgress({
				currentStep: Number.NaN,
				totalSteps: Number.POSITIVE_INFINITY,
			}),
		).toEqual({ currentStep: 1, totalSteps: 5 });
		expect(getLearningPlanCreationProgressPercentage(Number.NaN)).toBe(20);
	});
});
