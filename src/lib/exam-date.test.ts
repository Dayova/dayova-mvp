import { describe, expect, test } from "vitest";
import { getDayKey } from "./day-key";
import {
	buildExamDateOptions,
	findExamDateIndex,
	formatExamDateDay,
	formatExamDateMonth,
} from "./exam-date";

describe("exam date slider", () => {
	test("builds consecutive local calendar days starting today", () => {
		const options = buildExamDateOptions({
			selectedDate: new Date(2026, 6, 8),
			today: new Date(2026, 6, 5, 22, 30),
			futureDays: 3,
		});

		expect(options.map(getDayKey)).toEqual([
			"2026-07-05",
			"2026-07-06",
			"2026-07-07",
			"2026-07-08",
		]);
		expect(findExamDateIndex(options, new Date(2026, 6, 7))).toBe(2);
	});

	test("keeps an existing past selection reachable", () => {
		const options = buildExamDateOptions({
			selectedDate: new Date(2026, 6, 2),
			today: new Date(2026, 6, 5),
			futureDays: 3,
		});

		expect(options.slice(0, 4).map(getDayKey)).toEqual([
			"2026-07-02",
			"2026-07-03",
			"2026-07-04",
			"2026-07-05",
		]);
		expect(options.map(getDayKey).at(-1)).toBe("2026-07-08");
	});

	test("keeps a selection beyond the default future range reachable", () => {
		const options = buildExamDateOptions({
			selectedDate: new Date(2027, 6, 8),
			today: new Date(2026, 6, 5),
			futureDays: 3,
		});

		expect(options.map(getDayKey).at(0)).toBe("2026-07-05");
		expect(options.map(getDayKey).at(-1)).toBe("2027-07-08");
		expect(findExamDateIndex(options, new Date(2027, 6, 8))).toBe(
			options.length - 1,
		);
	});

	test("formats the selected date for the circular display", () => {
		const date = new Date(2026, 6, 5);

		expect(formatExamDateDay(date)).toBe("5");
		expect(formatExamDateMonth(date)).toBe("Juli");
	});
});
