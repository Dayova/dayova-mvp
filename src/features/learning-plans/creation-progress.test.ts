import { describe, expect, test } from "vitest";
import {
	getExamEntryCreationProgress,
	getLearningPlanCreationProgressPercentage,
	getSafeLearningPlanCreationProgress,
	LEARNING_PLAN_CREATION_STEPS,
	LEARNING_PLAN_CREATION_TOTAL_STEPS,
} from "./creation-progress";

describe("learning-plan creation progress", () => {
	test("advances visibly through the opening exam steps", () => {
		expect(LEARNING_PLAN_CREATION_STEPS).toEqual({
			examType: 1,
			examSubject: 1.5,
			examDate: 2,
			learningAvailability: 2.5,
			examTopics: 3,
			materialUpload: 3.5,
			materialAnalysis: 4,
			scopeConfirmation: 4.5,
			planGeneration: 5,
		});
		expect(LEARNING_PLAN_CREATION_TOTAL_STEPS).toBe(5);

		const openingProgress = [
			LEARNING_PLAN_CREATION_STEPS.examType,
			LEARNING_PLAN_CREATION_STEPS.examSubject,
			LEARNING_PLAN_CREATION_STEPS.examDate,
			LEARNING_PLAN_CREATION_STEPS.learningAvailability,
		];
		expect(
			openingProgress.every(
				(progress, index) =>
					index === 0 || progress > (openingProgress[index - 1] ?? 0),
			),
		).toBe(true);
	});

	test("turns intermediate progress into a changing percentage", () => {
		expect(
			(["examType", "examDetails", "basics", "learningAvailability"] as const)
				.map(getExamEntryCreationProgress)
				.map(getLearningPlanCreationProgressPercentage),
		).toEqual([20, 30, 40, 50]);
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
