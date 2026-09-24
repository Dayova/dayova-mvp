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
			examTopics: 2.5,
			materialUpload: 3,
			materialAnalysis: 3.5,
			scopeConfirmation: 4,
			planGeneration: 4.5,
		});
		expect(LEARNING_PLAN_CREATION_TOTAL_STEPS).toBe(4.5);

		const openingProgress = [
			LEARNING_PLAN_CREATION_STEPS.examType,
			LEARNING_PLAN_CREATION_STEPS.examSubject,
			LEARNING_PLAN_CREATION_STEPS.examDate,
			LEARNING_PLAN_CREATION_STEPS.examTopics,
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
			(["examType", "examDetails", "basics"] as const)
				.map(getExamEntryCreationProgress)
				.map(getLearningPlanCreationProgressPercentage),
		).toEqual([22, 33, 44]);
	});

	test("normalizes non-finite progress for visual and accessible output", () => {
		expect(
			getSafeLearningPlanCreationProgress({
				currentStep: Number.NaN,
				totalSteps: Number.POSITIVE_INFINITY,
			}),
		).toEqual({ currentStep: 1, totalSteps: 4.5 });
		expect(getLearningPlanCreationProgressPercentage(Number.NaN)).toBe(22);
	});
});
