import { describe, expect, test } from "vitest";
import { getStudyTimeFactBody } from "./study-time-fact";

describe("getStudyTimeFactBody", () => {
	test.each([
		15, 30, 45, 60, 90, 120, 150, 180, 210, 240,
	])("uses the selected %i-minute duration", (minutes) => {
		expect(getStudyTimeFactBody(`${minutes} min`)).toContain(
			`${minutes} Minuten`,
		);
	});

	test.each([
		"",
		"min",
		"unbekannt",
	])("falls back to 30 minutes for an invalid value (%s)", (value) => {
		expect(getStudyTimeFactBody(value)).toContain("30 Minuten");
	});
});
