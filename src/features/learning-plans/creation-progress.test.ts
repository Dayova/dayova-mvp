import { describe, expect, test } from "vitest";
import {
	getDiagnosticQuestionCreationStep,
	LEARNING_PLAN_CREATION_STEPS,
	LEARNING_PLAN_CREATION_TOTAL_STEPS,
} from "./creation-progress";

describe("learning-plan creation progress", () => {
	test("groups the creation flow into five stable stages", () => {
		expect(LEARNING_PLAN_CREATION_STEPS).toEqual({
			examDate: 1,
			examType: 1,
			examSubject: 1,
			materialUpload: 2,
			examEvidence: 2,
			scopeConfirmation: 3,
			diagnostic: 4,
			planGeneration: 5,
		});
		expect(LEARNING_PLAN_CREATION_TOTAL_STEPS).toBe(5);
	});

	test("keeps all diagnostic questions inside one visible stage", () => {
		expect(
			Array.from({ length: 5 }, (_, index) =>
				getDiagnosticQuestionCreationStep(index),
			),
		).toEqual([4, 4, 4, 4, 4]);
	});

	test("does not let malformed question indexes change the stage", () => {
		expect(getDiagnosticQuestionCreationStep(-1)).toBe(4);
		expect(getDiagnosticQuestionCreationStep(99)).toBe(4);
	});
});
