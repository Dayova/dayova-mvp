import { describe, expect, test } from "vitest";
import {
	GERMAN_FEDERAL_STATES,
	isGermanFederalState,
} from "./federal-states";

describe("federal state contract", () => {
	test("publishes every German federal state exactly once", () => {
		expect(GERMAN_FEDERAL_STATES).toEqual([
			"Bremen",
			"Hamburg",
			"Baden-Württemberg",
			"Sachsen",
			"Sachsen-Anhalt",
			"Brandenburg",
			"Bayern",
			"Berlin",
			"Hessen",
			"Niedersachsen",
			"Nordrhein-Westfalen",
			"Rheinland-Pfalz",
			"Saarland",
			"Schleswig-Holstein",
			"Thüringen",
			"Mecklenburg-Vorpommern",
		]);
		expect(new Set(GERMAN_FEDERAL_STATES).size).toBe(16);
	});

	test("accepts only published federal states", () => {
		for (const state of GERMAN_FEDERAL_STATES) {
			expect(isGermanFederalState(state)).toBe(true);
		}

		expect(isGermanFederalState("private state")).toBe(false);
		expect(isGermanFederalState(" Bayern ")).toBe(false);
		expect(isGermanFederalState(13)).toBe(false);
	});
});
