import { describe, expect, test } from "vitest";
import {
	dateForOnboardingTime,
	formatOnboardingTime,
	getOnboardingLearningTimeSummary,
	getOnboardingLearningTimeValidationError,
	getOnboardingLearningTimeWindow,
	parseOnboardingStudyDays,
	toggleOnboardingStudyDay,
} from "./onboarding-learning-times";

describe("onboarding learning times", () => {
	test("keeps multi-day choices ordered and toggles them without duplicates", () => {
		expect(toggleOnboardingStudyDay("Donnerstag", "Montag")).toBe(
			"Montag, Donnerstag",
		);
		expect(toggleOnboardingStudyDay("Montag, Donnerstag", "Donnerstag")).toBe(
			"Montag",
		);
		expect(
			parseOnboardingStudyDays("Sonntag, Montag, Montag, Feiertag"),
		).toEqual(["Montag", "Sonntag"]);
	});

	test("derives the exact same-day window shown to the learner", () => {
		expect(
			getOnboardingLearningTimeWindow({
				studyTime: "45",
				learningTime: "16:30",
			}),
		).toEqual({
			startTime: "16:30",
			endTime: "17:15",
			durationMinutes: 45,
		});
		expect(
			getOnboardingLearningTimeSummary({
				studyTime: "45",
				studyDays: "Montag, Mittwoch",
				learningTime: "16:30",
			}),
		).toEqual({
			daysLabel: "Montag und Mittwoch",
			durationLabel: "45 Minuten",
			windowLabel: "16:30–17:15 Uhr",
		});
	});

	test("never renders an invalid duration as NaN minutes", () => {
		expect(
			getOnboardingLearningTimeSummary({
				studyTime: "",
				studyDays: "Montag",
				learningTime: "16:30",
			}),
		).toMatchObject({ durationLabel: "" });
		expect(
			getOnboardingLearningTimeSummary({
				studyTime: "30 minutes",
				studyDays: "Montag",
				learningTime: "16:30",
			}),
		).toMatchObject({ durationLabel: "" });
	});

	test("requires a complete schedule and blocks windows crossing midnight", () => {
		expect(
			getOnboardingLearningTimeValidationError({
				studyTime: "",
				studyDays: "Montag",
				learningTime: "16:00",
			}),
		).toBe("Bitte wähle deine Lerndauer aus.");
		expect(
			getOnboardingLearningTimeValidationError({
				studyTime: "30",
				studyDays: "",
				learningTime: "16:00",
			}),
		).toBe("Bitte wähle mindestens einen Lerntag aus.");
		expect(
			getOnboardingLearningTimeValidationError({
				studyTime: "30",
				studyDays: "Montag",
				learningTime: "",
			}),
		).toBe("Bitte wähle eine Uhrzeit aus.");
		expect(
			getOnboardingLearningTimeValidationError({
				studyTime: "60",
				studyDays: "Montag",
				learningTime: "23:30",
			}),
		).toContain("vor Mitternacht");
	});

	test("round-trips the native picker value without a timezone conversion", () => {
		const date = dateForOnboardingTime("18:05");
		expect(formatOnboardingTime(date)).toBe("18:05");
	});
});
