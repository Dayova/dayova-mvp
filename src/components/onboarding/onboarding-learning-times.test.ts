import { describe, expect, test } from "vitest";
import {
	ONBOARDING_DURATION_OPTIONS,
	dateForOnboardingTime,
	formatOnboardingTime,
	getOnboardingLearningTimeSummary,
	getOnboardingLearningTimeValidationError,
	getOnboardingLearningTimeWindow,
	parseOnboardingDurationMinutes,
	parseOnboardingStudyDays,
	toggleOnboardingStudyDay,
} from "./onboarding-learning-times";

describe("onboarding learning times", () => {
	test("offers the agreed daily durations from 15 minutes through four hours", () => {
		expect(ONBOARDING_DURATION_OPTIONS).toEqual([
			15, 30, 45, 60, 90, 120, 150, 180, 210, 240,
		]);
	});
	test("keeps a personally chosen late start instead of shifting it to a default", () => {
		expect(
			getOnboardingLearningTimeSummary({
				studyTime: "60",
				studyDays: "Montag, Mittwoch",
				learningTime: "20:00",
			}),
		).toEqual({
			daysLabel: "Montag und Mittwoch",
			durationLabel: "1 Stunde",
			windowLabel: "20:00–21:00 Uhr",
		});
	});
	test.each([15, 30, 60, 210, 240])("retains exact duration %i", (minutes) => {
		expect(parseOnboardingDurationMinutes(String(minutes))).toBe(minutes);
	});
	test.each([
		"custom",
		"241",
		"270",
		"1000",
		"37",
		"270.5",
		"1440",
		"-15",
		"15 min",
	])("rejects invalid duration %s", (value) => {
		expect(parseOnboardingDurationMinutes(value)).toBeNull();
	});
	test("summarizes four hours with its exact end time", () => {
		expect(
			getOnboardingLearningTimeSummary({
				studyTime: "240",
				studyDays: "Montag",
				learningTime: "16:00",
			}),
		).toEqual({
			daysLabel: "Montag",
			durationLabel: "4 Stunden",
			windowLabel: "16:00–20:00 Uhr",
		});
	});
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
				studyTime: "30",
				studyDays: "Montag",
				learningTime: "nach der Schule",
			}),
		).toBe("Bitte wähle eine gültige Uhrzeit aus.");
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
		expect(formatOnboardingTime(dateForOnboardingTime("00:00"))).toBe("00:00");
		expect(formatOnboardingTime(dateForOnboardingTime("nach der Schule"))).toBe(
			"16:00",
		);
	});
});
