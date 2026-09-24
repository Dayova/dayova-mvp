import { describe, expect, test } from "vitest";
import { getDayKey } from "./day-key";
import { formatAccessibleExamDate, getExamDatePickerRange } from "./exam-date";

describe("exam date picker", () => {
	test("starts today and keeps the configured future range", () => {
		const range = getExamDatePickerRange({
			selectedDate: new Date(2026, 6, 8),
			today: new Date(2026, 6, 5, 22, 30),
			futureDays: 3,
		});

		expect(getDayKey(range.minimumDate)).toBe("2026-07-05");
		expect(getDayKey(range.maximumDate)).toBe("2026-07-08");
	});

	test("keeps an existing past selection reachable", () => {
		const range = getExamDatePickerRange({
			selectedDate: new Date(2026, 6, 2),
			today: new Date(2026, 6, 5),
			futureDays: 3,
		});

		expect(getDayKey(range.minimumDate)).toBe("2026-07-02");
		expect(getDayKey(range.maximumDate)).toBe("2026-07-08");
	});

	test("keeps a selection beyond the default future range reachable", () => {
		const range = getExamDatePickerRange({
			selectedDate: new Date(2027, 6, 8),
			today: new Date(2026, 6, 5),
			futureDays: 3,
		});

		expect(getDayKey(range.minimumDate)).toBe("2026-07-05");
		expect(getDayKey(range.maximumDate)).toBe("2027-07-08");
	});

	test("formats the selected date for the field and accessibility value", () => {
		const date = new Date(2026, 6, 5);

		expect(formatAccessibleExamDate(date)).toBe("5. Juli 2026");
	});
});
