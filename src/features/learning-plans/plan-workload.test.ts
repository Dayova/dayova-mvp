import { describe, expect, test } from "vitest";
import {
	calculateAvailableStudyMinutes,
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

	test("counts one recommended block per saved Lernzeit before the exam", () => {
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
		).toBe(80);
	});
});
