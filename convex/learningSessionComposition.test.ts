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

	test("starts a theory session with a three-minute knowledge check", () => {
		expect(
			getLearningSessionComposition({
				phase: "theory",
				durationMinutes: 20,
				variant: "split",
			}),
		).toEqual([
			{ phase: "practice", durationMinutes: 3 },
			{ phase: "theory", durationMinutes: 17 },
		]);
	});

	test("does not alter short theory slots or non-theory phases", () => {
		expect(
			getLearningSessionComposition({
				phase: "theory",
				durationMinutes: 5,
				variant: "split",
			}),
		).toEqual([{ phase: "theory", durationMinutes: 5 }]);
		expect(
			getLearningSessionComposition({
				phase: "practice",
				durationMinutes: 30,
				variant: "split",
			}),
		).toEqual([{ phase: "practice", durationMinutes: 30 }]);
	});

	test("marks every theory session that can fit both phases as eligible", () => {
		expect(
			isLearningSessionCompositionEligible({
				phase: "theory",
				durationMinutes: 7,
			}),
		).toBe(true);
		expect(
			isLearningSessionCompositionEligible({
				phase: "theory",
				durationMinutes: 20,
			}),
		).toBe(true);
		expect(
			isLearningSessionCompositionEligible({
				phase: "theory",
				durationMinutes: 5,
			}),
		).toBe(false);
		expect(
			isLearningSessionCompositionEligible({
				phase: "practice",
				durationMinutes: 30,
			}),
		).toBe(false);
	});
});
