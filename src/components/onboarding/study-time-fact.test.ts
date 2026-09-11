import { describe, expect, test } from "vitest";
import { ONBOARDING_DURATION_OPTIONS } from "./onboarding-learning-times";
import { getStudyTimeFactBody } from "./study-time-fact";

describe("getStudyTimeFactBody", () => {
	test.each(
		ONBOARDING_DURATION_OPTIONS,
	)("uses the selected %i-minute duration", (minutes) => {
		expect(getStudyTimeFactBody(`${minutes} min`)).toContain(
			`Wir verwenden ${minutes} Minuten als Dauer`,
		);
	});

	test.each([
		"",
		"min",
		"unbekannt",
	])("falls back to 30 minutes for an invalid value (%s)", (value) => {
		expect(getStudyTimeFactBody(value)).toContain(
			"Wir verwenden 30 Minuten als Dauer",
		);
	});
});
