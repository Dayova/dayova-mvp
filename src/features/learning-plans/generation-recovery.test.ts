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

	it("keeps an uncoded failure unknown and retryable", () => {
		expect(
			getLearningPlanGenerationFailure(new Error("Network error")),
		).toMatchObject({
			reason: "unknown",
			canReviewTopics: false,
			canEditMaterial: true,
			canEditLearningTimes: false,
		});
	});

	it("does not infer a cause from an uncoded error message", () => {
		expect(
			getLearningPlanGenerationFailure(
				new Error("Die Unterlagen konnten nicht verarbeitet werden."),
			),
		).toMatchObject({
			reason: "unknown",
			canEditMaterial: true,
		});
	});

	it("shows the AI's specific material gap when the backend classified it", () => {
		expect(
			getLearningPlanGenerationFailure({
				data: {
					kind: "userFacing",
					code: "insufficient_material",
					message: "Es fehlen Aufgaben zur Berechnung der Steigung.",
				},
			}),
		).toMatchObject({
			reason: "insufficientMaterial",
			message: "Es fehlen Aufgaben zur Berechnung der Steigung.",
		});
	});
});
