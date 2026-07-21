import { describe, expect, test } from "vitest";
import {
	FEDERAL_STATE_OPTIONS,
	isSupportedFederalState,
} from "./federal-states";

describe("federal state contract", () => {
	test("publishes every German federal state exactly once", () => {
		expect(FEDERAL_STATE_OPTIONS).toEqual([
			"Baden-Württemberg",
			"Bayern",
			"Berlin",
			"Brandenburg",
			"Bremen",
			"Hamburg",
			"Hessen",
			"Mecklenburg-Vorpommern",
			"Niedersachsen",
			"Nordrhein-Westfalen",
			"Rheinland-Pfalz",
			"Saarland",
			"Sachsen",
			"Sachsen-Anhalt",
			"Schleswig-Holstein",
			"Thüringen",
		]);
		expect(new Set(FEDERAL_STATE_OPTIONS).size).toBe(16);
	});

	test("accepts only published federal states", () => {
		for (const state of FEDERAL_STATE_OPTIONS) {
			expect(isSupportedFederalState(state)).toBe(true);
		}

		expect(isSupportedFederalState("private state")).toBe(false);
		expect(isSupportedFederalState(" Bayern ")).toBe(false);
		expect(isSupportedFederalState(13)).toBe(false);
	});
});
