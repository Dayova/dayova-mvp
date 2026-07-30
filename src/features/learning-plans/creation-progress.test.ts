import { describe, expect, test } from "vitest";
import {
	getDiagnosticQuestionCreationStep,
	LEARNING_PLAN_CREATION_STEPS,
	LEARNING_PLAN_CREATION_TOTAL_STEPS,
} from "./creation-progress";

describe("learning-plan creation progress", () => {
	test("counts every learner input page from exam details through workload", () => {
		expect(LEARNING_PLAN_CREATION_STEPS).toEqual({
			examDate: 1,
			examType: 2,
			examSubject: 3,
			materialUpload: 4,
			examEvidence: 5,
			scopeConfirmation: 6,
			workload: 12,
		});
		expect(LEARNING_PLAN_CREATION_TOTAL_STEPS).toBe(12);
	});

	test("maps all five diagnostic questions between topic and workload", () => {
		expect(
			Array.from({ length: 5 }, (_, index) =>
				getDiagnosticQuestionCreationStep(index),
			),
		).toEqual([7, 8, 9, 10, 11]);
	});

	test("keeps malformed diagnostic indexes inside the question range", () => {
		expect(getDiagnosticQuestionCreationStep(-1)).toBe(7);
		expect(getDiagnosticQuestionCreationStep(99)).toBe(11);
	});
});
