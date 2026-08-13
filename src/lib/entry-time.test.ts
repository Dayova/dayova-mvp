import { describe, expect, test } from "vitest";
import {
	constrainEndTimeForStart,
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

	test("supports short entries down to three minutes", () => {
		const options = { minimumMinutes: 3, maximumMinutes: 360 };

		expect(getDurationBetweenTimes(time(9, 0), time(9, 3), options)).toBe(3);
		expect(getDurationBetweenTimes(time(9, 0), time(9, 1), options)).toBe(3);
	});

	test("limits entries to six hours", () => {
		expect(
			getDurationBetweenTimes(time(8, 0), time(18, 0), {
				minimumMinutes: 3,
				maximumMinutes: 360,
			}),
		).toBe(360);
	});

	test("normalizes the displayed end time to the supported duration", () => {
		const constrainedEnd = constrainEndTimeForStart({
			start: time(8, 0),
			end: time(18, 0),
			minimumMinutes: 3,
			maximumMinutes: 360,
		});

		expect(constrainedEnd.getHours()).toBe(14);
		expect(constrainedEnd.getMinutes()).toBe(0);
	});
});
