import { describe, expect, test } from "vitest";
import {
	deriveOnboardingLearningTimes,
	deriveProposedLearningTimes,
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

	test("allows a learning window that ends exactly at midnight", () => {
		expect(
			deriveOnboardingLearningTimes({
				studyDays: "Freitag",
				learningTime: "23:30",
				dailySchoolTime: "30 min",
			}),
		).toEqual({
			ok: true,
			windows: [{ dayOfWeek: 5, startTime: "23:30", endTime: "00:00" }],
		});
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

describe("deriveProposedLearningTimes", () => {
	test("proposes three upcoming grade 5-8 windows before the exam", () => {
		expect(
			deriveProposedLearningTimes({
				currentDateKey: "2026-06-01",
				currentTimeMinutes: 12 * 60,
				examDateKey: "2026-06-05",
				grade: "8",
			}),
		).toEqual([
			{ dayOfWeek: 1, startTime: "16:00", endTime: "20:00" },
			{ dayOfWeek: 2, startTime: "16:00", endTime: "20:00" },
			{ dayOfWeek: 3, startTime: "16:00", endTime: "20:00" },
		]);
	});

	test.each([
		{ grade: "9", endTime: "22:00" },
		{ grade: "10", endTime: "22:00" },
		{ grade: "11", endTime: "00:00" },
		{ grade: "13", endTime: "00:00" },
		{ grade: undefined, endTime: "20:00" },
	])("uses the $endTime grade boundary for grade $grade", ({
		grade,
		endTime,
	}) => {
		expect(
			deriveProposedLearningTimes({
				currentDateKey: "2026-06-01",
				currentTimeMinutes: 12 * 60,
				examDateKey: "2026-06-02",
				grade,
			}),
		).toEqual([{ dayOfWeek: 1, startTime: "16:00", endTime }]);
	});

	test("uses a near-term future window for an exam today", () => {
		expect(
			deriveProposedLearningTimes({
				currentDateKey: "2026-06-01",
				currentTimeMinutes: 17 * 60 + 3,
				examDateKey: "2026-06-01",
				grade: "9",
			}),
		).toEqual([{ dayOfWeek: 1, startTime: "17:20", endTime: "22:00" }]);
	});

	test("does not propose a window after the grade boundary", () => {
		expect(
			deriveProposedLearningTimes({
				currentDateKey: "2026-06-01",
				currentTimeMinutes: 20 * 60,
				examDateKey: "2026-06-01",
				grade: "7",
			}),
		).toEqual([]);
	});

	test("returns no misleading fallback when the exam is already past", () => {
		expect(
			deriveProposedLearningTimes({
				currentDateKey: "2026-06-02",
				currentTimeMinutes: 12 * 60,
				examDateKey: "2026-06-01",
			}),
		).toEqual([]);
	});
});
