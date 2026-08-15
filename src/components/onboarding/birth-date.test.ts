import { describe, expect, test } from "vitest";
import {
	formatOnboardingBirthDate,
	getBirthDayValues,
	getBirthMonthValues,
	getBirthYearValues,
} from "./birth-date";

describe("onboarding birth date", () => {
	test("offers years newest-first without silently choosing one", () => {
		expect(getBirthYearValues(2026).slice(0, 3)).toEqual([
			"2026",
			"2025",
			"2024",
		]);
	});

	test("derives valid days from the selected year and month", () => {
		expect(getBirthDayValues("2024", "02")).toHaveLength(29);
		expect(getBirthDayValues("2025", "02")).toHaveLength(28);
		expect(getBirthDayValues("2025", "04")).toHaveLength(30);
	});

	test("does not offer future months or days in the current year", () => {
		const today = new Date(2026, 7, 11);
		expect(getBirthMonthValues("2026", today)).toEqual([
			"01",
			"02",
			"03",
			"04",
			"05",
			"06",
			"07",
			"08",
		]);
		expect(getBirthDayValues("2026", "08", today)).toHaveLength(11);
		expect(getBirthDayValues("2026", "09", today)).toEqual([]);
		expect(getBirthDayValues("2027", "01", today)).toEqual([]);
	});

	test("formats only a valid explicit year-month-day combination", () => {
		expect(
			formatOnboardingBirthDate({ year: "2012", month: "09", day: "09" }),
		).toBe("09.09.2012");
		expect(
			formatOnboardingBirthDate({ year: "2012", month: "02", day: "31" }),
		).toBe("");
	});

	test("rejects partial or otherwise non-canonical year and month values", () => {
		const today = new Date(2026, 7, 11);

		expect(getBirthMonthValues("2026x", today)).toEqual([]);
		expect(getBirthDayValues("2012x", "02", today)).toEqual([]);
		expect(getBirthDayValues("2012", "02x", today)).toEqual([]);
		expect(
			formatOnboardingBirthDate({
				year: "2012x",
				month: "02x",
				day: "09",
			}),
		).toBe("");
	});

	test("rejects years outside the same 121-year range exposed by the picker", () => {
		const today = new Date(2026, 7, 11);

		expect(getBirthMonthValues("1906", today)).toHaveLength(12);
		expect(getBirthDayValues("1906", "08", today)).toHaveLength(31);
		expect(
			formatOnboardingBirthDate(
				{ year: "1906", month: "08", day: "11" },
				today,
			),
		).toBe("11.08.1906");

		expect(getBirthMonthValues("1905", today)).toEqual([]);
		expect(getBirthDayValues("1905", "08", today)).toEqual([]);
		expect(
			formatOnboardingBirthDate(
				{ year: "1905", month: "08", day: "11" },
				today,
			),
		).toBe("");
	});
});
