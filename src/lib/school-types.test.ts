import { describe, expect, test } from "vitest";
import {
	isSupportedSchoolType,
	normalizeLegacySchoolType,
	SCHOOL_TYPE_OPTIONS,
} from "./school-types";

describe("school type contract", () => {
	test("publishes only the approved stable keys and German labels", () => {
		expect(SCHOOL_TYPE_OPTIONS).toEqual([
			{ value: "gymnasium", label: "Gymnasium" },
			{
				value: "secondary_general",
				label: "Oberschule / Realschule / Sekundarschule",
			},
			{
				value: "comprehensive",
				label: "Gesamt- / Gemeinschaftsschule",
			},
			{ value: "hauptschule", label: "Hauptschule" },
			{ value: "vocational", label: "Berufliche Schule" },
			{ value: "other", label: "Andere Schulart" },
			{ value: "prefer_not_to_say", label: "Keine Angabe" },
		]);
	});

	test("accepts every stable key and rejects free-text school names", () => {
		for (const option of SCHOOL_TYPE_OPTIONS) {
			expect(isSupportedSchoolType(option.value)).toBe(true);
		}

		expect(isSupportedSchoolType("Goethe-Gymnasium Dresden")).toBe(false);
		expect(isSupportedSchoolType("Gymnasium")).toBe(false);
		expect(isSupportedSchoolType(13)).toBe(false);
	});

	test("maps only exact generic legacy values and drops identifiable text", () => {
		const genericLegacyValues = [
			["Gymnasium", "gymnasium"],
			["Oberschule", "secondary_general"],
			["Realschule", "secondary_general"],
			["Sekundarschule", "secondary_general"],
			["Gesamtschule", "comprehensive"],
			["Gemeinschaftsschule", "comprehensive"],
			["Hauptschule", "hauptschule"],
			["Berufsschule", "vocational"],
			["Berufliche Schule", "vocational"],
			["Andere Schulart", "other"],
			["Keine Angabe", "prefer_not_to_say"],
		] as const;

		for (const [legacyValue, expected] of genericLegacyValues) {
			expect(normalizeLegacySchoolType(legacyValue)).toBe(expected);
		}

		expect(normalizeLegacySchoolType("  GYMNASIUM  ")).toBe("gymnasium");
		expect(normalizeLegacySchoolType("Goethe-Gymnasium Dresden")).toBe(
			undefined,
		);
		expect(normalizeLegacySchoolType("Realschule am Stadtpark")).toBe(
			undefined,
		);
		expect(normalizeLegacySchoolType("")).toBe(undefined);
		expect(normalizeLegacySchoolType(null)).toBe(undefined);
	});
});
