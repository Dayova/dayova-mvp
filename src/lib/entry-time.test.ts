import { describe, expect, test } from "vitest";
import {
	getDurationBetweenTimes,
	shiftEndTimeForStartChange,
} from "./entry-time";

const time = (hours: number, minutes: number) => {
	const date = new Date("2026-06-05T00:00:00.000");
	date.setHours(hours, minutes, 0, 0);
	return date;
};

describe("entry time helpers", () => {
	test("keeps the existing duration when the start time changes", () => {
		const nextEnd = shiftEndTimeForStartChange({
			previousStart: time(16, 0),
			previousEnd: time(16, 30),
			nextStart: time(7, 0),
		});

		expect(nextEnd.getHours()).toBe(7);
		expect(nextEnd.getMinutes()).toBe(30);
	});

	test("does not turn an end time chosen before the start into a stale long exam", () => {
		const nextEnd = shiftEndTimeForStartChange({
			previousStart: time(16, 0),
			previousEnd: time(10, 30),
			nextStart: time(7, 0),
		});

		expect(getDurationBetweenTimes(time(7, 0), nextEnd)).toBe(15);
		expect(nextEnd.getHours()).toBe(7);
		expect(nextEnd.getMinutes()).toBe(15);
	});
});
