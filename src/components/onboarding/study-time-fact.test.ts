import { describe, expect, test } from "vitest";
import {
	formatOnboardingDuration,
	ONBOARDING_DURATION_OPTIONS,
} from "./onboarding-learning-times";
import { getStudyTimeFactBody } from "./study-time-fact";

describe("getStudyTimeFactBody", () => {
	test.each(
		ONBOARDING_DURATION_OPTIONS,
	)("uses the selected %i-minute duration", (minutes) => {
		expect(getStudyTimeFactBody(String(minutes))).toContain(
			formatOnboardingDuration(minutes),
		);
	});

	test.each([
		"",
		"min",
		"unbekannt",
	])("does not invent a duration for an invalid value (%s)", (value) => {
		expect(getStudyTimeFactBody(value)).toContain(
			"Wähle die Lernzeit, die in deinen Alltag passt.",
		);
	});
});
