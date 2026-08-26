import { describe, expect, test } from "vitest";
import {
	BIRTH_DATE_INVALID_ERROR,
	BIRTH_DATE_REQUIRED_ERROR,
	BIRTH_DATE_UNDER_MINIMUM_ERROR,
	getAgeAssuranceResult,
	getBirthDateError,
	getLatestEligibleBirthDate,
	requireEligibleBirthDate,
} from "./age-assurance";

const REFERENCE_DATE = new Date(2026, 7, 26, 12);

describe("age assurance", () => {
	test("accepts a learner on their thirteenth birthday", () => {
		expect(getAgeAssuranceResult("26.08.2013", REFERENCE_DATE)).toEqual({
			status: "verified",
			age: 13,
			ageBand: "13_15",
			normalizedBirthDate: "26.08.2013",
		});
		expect(getBirthDateError("26.08.2013", REFERENCE_DATE)).toBeNull();
	});

	test("rejects a learner before their thirteenth birthday", () => {
		expect(getBirthDateError("27.08.2013", REFERENCE_DATE)).toBe(
			BIRTH_DATE_UNDER_MINIMUM_ERROR,
		);
	});

	test("rejects impossible and future dates", () => {
		expect(getBirthDateError("31.02.2012", REFERENCE_DATE)).toBe(
			BIRTH_DATE_INVALID_ERROR,
		);
		expect(getBirthDateError("27.08.2026", REFERENCE_DATE)).toBe(
			BIRTH_DATE_INVALID_ERROR,
		);
	});

	test("requires a birth date", () => {
		expect(getBirthDateError("", REFERENCE_DATE)).toBe(
			BIRTH_DATE_REQUIRED_ERROR,
		);
	});

	test("normalizes a valid date at a write boundary", () => {
		expect(requireEligibleBirthDate("9.9.2000", REFERENCE_DATE)).toBe(
			"09.09.2000",
		);
	});

	test("returns the latest selectable eligible birth date", () => {
		expect(getLatestEligibleBirthDate(REFERENCE_DATE)).toEqual(
			new Date(2013, 7, 26),
		);
	});
});
