import { describe, expect, test } from "vitest";
import {
	getAutomaticLearningWindow,
	parseLearningWindowEnd,
} from "./learningTimePolicy";

describe("getAutomaticLearningWindow", () => {
	test.each([
		{ grade: "5", endTime: "20:00", endMinutes: 20 * 60 },
		{ grade: "8", endTime: "20:00", endMinutes: 20 * 60 },
		{ grade: "9", endTime: "22:00", endMinutes: 22 * 60 },
		{ grade: "10", endTime: "22:00", endMinutes: 22 * 60 },
		{ grade: "11", endTime: "00:00", endMinutes: 24 * 60 },
		{ grade: "13", endTime: "00:00", endMinutes: 24 * 60 },
		{ grade: undefined, endTime: "20:00", endMinutes: 20 * 60 },
	])("returns the expected boundary for grade $grade", ({
		grade,
		endTime,
		endMinutes,
	}) => {
		expect(getAutomaticLearningWindow(grade)).toMatchObject({
			startTime: "16:00",
			endTime,
			endMinutes,
		});
	});

	test("treats 00:00 as the end of the same learning day", () => {
		expect(parseLearningWindowEnd("16:00", "00:00")).toBe(24 * 60);
	});
});
