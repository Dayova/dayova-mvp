import { describe, expect, test } from "vitest";
import {
	getLearningSessionComposition,
	isLearningSessionCompositionEligible,
} from "./learningSessionComposition";

describe("learning session composition", () => {
	test("keeps the control variant as one 30-minute theory segment", () => {
		expect(
			getLearningSessionComposition({
				phase: "theory",
				durationMinutes: 30,
				variant: "control",
			}),
		).toEqual([{ phase: "theory", durationMinutes: 30 }]);
	});

	test("splits the treatment into theory and practice in the same session", () => {
		expect(
			getLearningSessionComposition({
				phase: "theory",
				durationMinutes: 30,
				variant: "split",
			}),
		).toEqual([
			{ phase: "theory", durationMinutes: 20 },
			{ phase: "practice", durationMinutes: 10 },
		]);
	});

	test("does not alter ineligible durations or phases", () => {
		expect(
			getLearningSessionComposition({
				phase: "theory",
				durationMinutes: 20,
				variant: "split",
			}),
		).toEqual([{ phase: "theory", durationMinutes: 20 }]);
		expect(
			getLearningSessionComposition({
				phase: "practice",
				durationMinutes: 30,
				variant: "split",
			}),
		).toEqual([{ phase: "practice", durationMinutes: 30 }]);
	});

	test("marks only 30-minute theory sessions as experiment eligible", () => {
		expect(
			isLearningSessionCompositionEligible({
				phase: "theory",
				durationMinutes: 30,
			}),
		).toBe(true);
		expect(
			isLearningSessionCompositionEligible({
				phase: "practice",
				durationMinutes: 30,
			}),
		).toBe(false);
	});
});
