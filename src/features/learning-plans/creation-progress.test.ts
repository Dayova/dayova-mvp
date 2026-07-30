import { describe, expect, test } from "vitest";
import {
	getDiagnosticQuestionCreationStep,
	getExamEntryCreationProgress,
	getLearningPlanCreationProgressPercentage,
	LEARNING_PLAN_CREATION_STEPS,
	LEARNING_PLAN_CREATION_TOTAL_STEPS,
} from "./creation-progress";

describe("learning-plan creation progress", () => {
	test("advances visibly through the opening exam questions", () => {
		expect(LEARNING_PLAN_CREATION_STEPS).toEqual({
			examDate: 1,
			learningAvailability: 1.25,
			examType: 1.5,
			examSubject: 1.75,
			materialUpload: 2,
			examEvidence: 2.5,
			materialAnalysis: 2.75,
			scopeConfirmation: 3,
			diagnostic: 3.25,
			planGeneration: 5,
		});
		expect(LEARNING_PLAN_CREATION_TOTAL_STEPS).toBe(5);

		const openingProgress = [
			LEARNING_PLAN_CREATION_STEPS.examDate,
			LEARNING_PLAN_CREATION_STEPS.learningAvailability,
			LEARNING_PLAN_CREATION_STEPS.examType,
			LEARNING_PLAN_CREATION_STEPS.examSubject,
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
			(["basics", "learningAvailability", "examType", "examDetails"] as const)
				.map(getExamEntryCreationProgress)
				.map(getLearningPlanCreationProgressPercentage),
		).toEqual([20, 25, 30, 35]);
	});

	test("advances through each diagnostic answer", () => {
		expect(
			Array.from({ length: 5 }, (_, index) =>
				getDiagnosticQuestionCreationStep(index),
			),
		).toEqual([3.25, 3.625, 4, 4.375, 4.75]);
	});

	test("clamps malformed diagnostic question indexes", () => {
		expect(getDiagnosticQuestionCreationStep(-1)).toBe(3.25);
		expect(getDiagnosticQuestionCreationStep(99)).toBe(4.75);
	});
});
