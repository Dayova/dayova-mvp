import { describe, expect, test } from "vitest";
import {
	calculateAvailableStudyMinutes,
	getAutomaticLearningPreparation,
	shouldRequestLearningTimeBeforeExam,
	shouldShowLearningTimeValidation,
	suggestTotalStudyMinutes,
} from "./plan-workload";

describe("total study workload suggestion", () => {
	test("suggests 60 minutes for a 90-minute exam with concrete answers", () => {
		expect(
			suggestTotalStudyMinutes({
				examDurationMinutes: 90,
				answers: [
					"Ich kann die Grundbegriffe erklären.",
					"Bei Transferaufgaben brauche ich noch Übung.",
				],
				availableMinutes: 120,
			}),
		).toBe(60);
	});

	test("adds focused time for uncertain diagnostic answers", () => {
		expect(
			suggestTotalStudyMinutes({
				examDurationMinutes: 90,
				answers: ["Weiß ich nicht", "Keine Ahnung", "Unsicher"],
				availableMinutes: 120,
			}),
		).toBe(90);
	});

	test("does not suggest more time than saved learning times can hold", () => {
		expect(
			suggestTotalStudyMinutes({
				examDurationMinutes: 90,
				answers: ["Weiß ich nicht"],
				availableMinutes: 50,
			}),
		).toBe(50);
	});

	test("counts the usable minutes for several short sessions in a saved Lernzeit", () => {
		expect(
			calculateAvailableStudyMinutes({
				fromDateKey: "2026-06-01",
				examDateKey: "2026-06-05",
				learningTimes: [
					{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" },
					{ dayOfWeek: 2, startTime: "17:00", endTime: "17:20" },
					{ dayOfWeek: 4, startTime: "16:00", endTime: "17:30" },
				],
			}),
		).toBe(170);
	});

	test("does not count a saved Lernzeit that is already fully occupied", () => {
		expect(
			calculateAvailableStudyMinutes({
				fromDateKey: "2026-06-01",
				examDateKey: "2026-06-03",
				learningTimes: [{ dayOfWeek: 2, startTime: "17:00", endTime: "18:00" }],
				occupiedEntries: [
					{
						dayKey: "2026-06-02",
						time: "17:00",
						durationMinutes: 60,
					},
				],
			}),
		).toBe(0);
	});

	test("does not count a learning window that has already started today", () => {
		expect(
			calculateAvailableStudyMinutes({
				fromDateKey: "2026-06-02",
				fromTimeMinutes: 17 * 60,
				examDateKey: "2026-06-03",
				learningTimes: [{ dayOfWeek: 2, startTime: "17:00", endTime: "18:00" }],
			}),
		).toBe(0);
	});

	test("requests enough learning time for the two-session rolling horizon", () => {
		expect(
			shouldRequestLearningTimeBeforeExam({
				fromDateKey: "2026-06-01",
				examDateKey: "2026-06-05",
				learningTimes: [],
			}),
		).toBe(true);
		expect(
			shouldRequestLearningTimeBeforeExam({
				fromDateKey: "2026-06-01",
				examDateKey: "2026-06-05",
				learningTimes: [{ dayOfWeek: 2, startTime: "17:00", endTime: "17:10" }],
			}),
		).toBe(true);
		expect(
			shouldRequestLearningTimeBeforeExam({
				fromDateKey: "2026-06-01",
				examDateKey: "2026-06-05",
				learningTimes: [{ dayOfWeek: 2, startTime: "17:00", endTime: "17:30" }],
			}),
		).toBe(false);
		expect(
			shouldRequestLearningTimeBeforeExam({
				fromDateKey: "2026-06-01",
				examDateKey: "2026-06-01",
				learningTimes: [],
			}),
		).toBe(false);
	});

	test("shows the learning-time validation for every future exam", () => {
		expect(
			shouldShowLearningTimeValidation({
				fromDateKey: "2026-06-01",
				examDateKey: "2026-06-05",
			}),
		).toBe(true);
		expect(
			shouldShowLearningTimeValidation({
				fromDateKey: "2026-06-01",
				examDateKey: "2026-06-01",
			}),
		).toBe(false);
	});

	test("automatically caps the recommended preparation to saved availability", () => {
		const result = getAutomaticLearningPreparation({
			examTypeLabel: "Klassenarbeit",
			examDurationMinutes: 90,
			topicCount: 4,
			answerCount: 5,
			topicReadiness: [
				{ status: "secure" },
				{ status: "developing" },
				{ status: "unknown" },
			],
			availableMinutes: 85,
		});

		expect(result.preparationDepth).toBe("thorough");
		expect(result.recommendation.plannedMinutes).toBe(85);
		expect(result.recommendation.preparationGapMinutes).toBeGreaterThan(0);
	});
});
