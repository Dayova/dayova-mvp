import { describe, expect, it } from "vitest";
import { getLearningPlanGenerationFailure } from "./generation-recovery";

describe("getLearningPlanGenerationFailure", () => {
	it("uses explicit backend failure codes", () => {
		expect(
			getLearningPlanGenerationFailure({
				data: {
					kind: "userFacing",
					code: "scheduling_constraints",
					message: "Keine freien Zeiten.",
				},
			}),
		).toMatchObject({
			reason: "schedulingConstraints",
			canEditLearningTimes: true,
			canEditMaterial: false,
		});
	});

	it("keeps persisted failure reasons stable after the action error is gone", () => {
		expect(
			getLearningPlanGenerationFailure(null, "insufficientMaterial"),
		).toMatchObject({
			reason: "insufficientMaterial",
			canReviewTopics: true,
			canEditMaterial: true,
		});
	});

	it("falls back to a retryable processing failure", () => {
		expect(
			getLearningPlanGenerationFailure(new Error("Network error")),
		).toMatchObject({
			reason: "generationProcessing",
			canReviewTopics: false,
			canEditMaterial: false,
			canEditLearningTimes: false,
		});
	});
});
