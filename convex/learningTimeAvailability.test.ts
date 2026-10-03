import { describe, expect, test } from "vitest";
import {
	deriveOnboardingLearningTimes,
	getOnboardingLearningTimeErrorMessage,
} from "./learningTimeAvailability";

describe("deriveOnboardingLearningTimes", () => {
	test("derives one same-day window per selected weekday", () => {
		expect(
			deriveOnboardingLearningTimes({
				studyDays: "Mittwoch, Montag, Mittwoch",
				learningTime: "16:30",
				dailySchoolTime: "45 min",
			}),
		).toEqual({
			ok: true,
			windows: [
				{ dayOfWeek: 1, startTime: "16:30", endTime: "17:15" },
				{ dayOfWeek: 3, startTime: "16:30", endTime: "17:15" },
			],
		});
	});

	test("rejects ranges that would cross midnight", () => {
		const result = deriveOnboardingLearningTimes({
			studyDays: "Freitag",
			learningTime: "23:30",
			dailySchoolTime: "60 min",
		});

		expect(result).toEqual({ ok: false, reason: "crossesMidnight" });
		if (result.ok) throw new Error("Expected an invalid derived range.");
		expect(getOnboardingLearningTimeErrorMessage(result.reason)).toContain(
			"vor Mitternacht",
		);
	});

	test.each([
		{
			input: {
				studyDays: "",
				learningTime: "16:30",
				dailySchoolTime: "45 min",
			},
			reason: "missingDays",
		},
		{
			input: {
				studyDays: "Feiertag",
				learningTime: "16:30",
				dailySchoolTime: "45 min",
			},
			reason: "invalidDay",
		},
		{
			input: {
				studyDays: "Montag",
				learningTime: "nachmittags",
				dailySchoolTime: "45 min",
			},
			reason: "invalidTime",
		},
		{
			input: {
				studyDays: "Montag",
				learningTime: "16:30",
				dailySchoolTime: "irgendwann",
			},
			reason: "invalidDuration",
		},
	] as const)("rejects $reason legacy input", ({ input, reason }) => {
		expect(deriveOnboardingLearningTimes(input)).toEqual({
			ok: false,
			reason,
		});
	});
});
