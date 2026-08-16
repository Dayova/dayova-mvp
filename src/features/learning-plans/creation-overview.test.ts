import { describe, expect, test } from "vitest";
import { getLearningPlanCreationOverview } from "./creation-overview";

describe("learning plan creation overview", () => {
	test.each([
		["draft", true, undefined, "Schulmaterial fehlt"],
		["draft", false, undefined, "Schulmaterial gespeichert"],
		["questionsReady", false, undefined, "Prüfungsstoff bestätigen"],
		["questionsReady", false, 1, "Lernweg wird vorbereitet"],
		["generated", false, 1, "Lernweg prüfen"],
	] as const)("presents %s plans as resumable creation work", (status, needsSchoolMaterial, scopeConfirmedAt, progressLabel) => {
		expect(
			getLearningPlanCreationOverview({
				status,
				needsSchoolMaterial,
				scopeConfirmedAt,
			}),
		).toEqual({
			badgeLabel: "Noch nicht erstellt",
			actionLabel: "Lernplan-Erstellung fortsetzen",
			progressLabel,
		});
	});

	test("keeps accepted plans out of the creation section", () => {
		expect(
			getLearningPlanCreationOverview({
				status: "accepted",
				needsSchoolMaterial: false,
			}),
		).toBeNull();
	});
});
