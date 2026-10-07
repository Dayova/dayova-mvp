import { describe, expect, it } from "vitest";
import { userFacingError } from "./errors";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

describe("content generation failure reasons", () => {
	it.each([
		["material_processing", "materialProcessing"],
		["scheduling_constraints", "schedulingConstraints"],
		["generation_processing", "generationProcessing"],
		["insufficient_material", "insufficientMaterial"],
	] as const)("maps %s to %s", (code, reason) => {
		expect(
			__testOnlyLearningPlanAi.getContentGenerationFailureReason(
				userFacingError("Fehler beim Erstellen", code),
			),
		).toBe(reason);
	});

	it("keeps uncoded failures neutral", () => {
		expect(
			__testOnlyLearningPlanAi.getContentGenerationFailureReason(
				new Error("Unbekannter Fehler"),
			),
		).toBe("unknown");
	});
});
