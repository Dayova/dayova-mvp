import { describe, expect, it } from "vitest";
import { decideMaterialReadiness } from "./materialAssessment";

const completeOutput = {
	sourceSummary: "Lineare Funktionen und Steigung als Prüfungsstoff.",
	topicCount: 3,
	questionCount: 5,
};

describe("decideMaterialReadiness", () => {
	it("accepts a usable assessment with enough generated content", () => {
		expect(
			decideMaterialReadiness(
				{ verdict: "sufficient", missingInformation: "" },
				completeOutput,
			),
		).toEqual({ kind: "ready" });
	});

	it("uses a specific material gap only after a valid AI assessment", () => {
		expect(
			decideMaterialReadiness(
				{
					verdict: "insufficient",
					missingInformation:
						" Es fehlen Aufgaben oder Erklärungen zur Steigung. ",
				},
				{ sourceSummary: "", topicCount: 0, questionCount: 0 },
			),
		).toEqual({
			kind: "insufficientMaterial",
			missingInformation: "Es fehlen Aufgaben oder Erklärungen zur Steigung.",
		});
	});

	it("does not treat an uncertain or unexplained assessment as a material failure", () => {
		expect(
			decideMaterialReadiness(
				{ verdict: "uncertain", missingInformation: "" },
				completeOutput,
			),
		).toEqual({ kind: "unknown" });
		expect(
			decideMaterialReadiness(
				{ verdict: "insufficient", missingInformation: "zu wenig" },
				completeOutput,
			),
		).toEqual({ kind: "unknown" });
		expect(
			decideMaterialReadiness(
				{
					verdict: "insufficient",
					missingInformation: "Es fehlen Aufgaben zur Steigung.",
				},
				completeOutput,
			),
		).toEqual({ kind: "unknown" });
	});

	it("treats incomplete output despite a sufficient verdict as a generation failure", () => {
		expect(
			decideMaterialReadiness(
				{ verdict: "sufficient", missingInformation: "" },
				{ ...completeOutput, questionCount: 2 },
			),
		).toEqual({ kind: "generationProcessing" });
	});
});
