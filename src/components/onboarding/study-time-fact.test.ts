import { describe, expect, test } from "vitest";
import { getStudyTimeFactBody } from "./study-time-fact";

const STUDY_TIME_OPTIONS = [
	10, 20, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
] as const;

describe("getStudyTimeFactBody", () => {
	test.each(
		STUDY_TIME_OPTIONS,
	)("uses the selected %i-minute duration", (minutes) => {
		expect(getStudyTimeFactBody(`${minutes} min`)).toContain(
			`Deine ${minutes} Minuten reichen aus`,
		);
	});

	test.each([
		"",
		"min",
		"unbekannt",
	])("falls back to 30 minutes for an invalid value (%s)", (value) => {
		expect(getStudyTimeFactBody(value)).toContain(
			"Deine 30 Minuten reichen aus",
		);
	});
});
