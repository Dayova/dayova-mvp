import { describe, expect, it } from "vitest";
import {
	CONTINUE_LEARNING_MINUTES,
	getLearningSessionItems,
	getLearningSessionCompletionPhase,
	getLearningSessionRepeatStartIndex,
	isQualifiedSessionCompletion,
	shouldKeepSplitTheoryActive,
	shouldTransitionToSplitPractice,
	shouldRepeatSessionContent,
} from "./session-progress";

const learnCard = { id: "theory", kind: "learnCard" } as const;
const practiceTask = { id: "practice", kind: "written" } as const;

describe("learning session progress", () => {
	it("keeps a control theory session focused on learning cards", () => {
		expect(
			getLearningSessionItems([learnCard, practiceTask], "theory", "control"),
		).toEqual([learnCard]);
	});

	it("moves through theory and practice in a split session", () => {
		expect(
			getLearningSessionItems([learnCard, practiceTask], "theory", "split"),
		).toEqual([learnCard, practiceTask]);
		expect(getLearningSessionCompletionPhase("theory", "split")).toBe(
			"practice",
		);
	});

	it("qualifies a 30-minute completion after 24 active minutes", () => {
		expect(isQualifiedSessionCompletion(30, 24 * 60)).toBe(true);
		expect(isQualifiedSessionCompletion(30, 24 * 60 - 1)).toBe(false);
	});

	it("offers a repeatable ten-minute continuation", () => {
		expect(CONTINUE_LEARNING_MINUTES).toBe(10);
	});

	it("repeats content until the planned timer ends", () => {
		expect(shouldRepeatSessionContent(1)).toBe(true);
		expect(shouldRepeatSessionContent(0)).toBe(false);
	});

	it("keeps split sessions in theory until the final ten minutes", () => {
		expect(shouldKeepSplitTheoryActive("split", false, 601)).toBe(true);
		expect(shouldKeepSplitTheoryActive("split", false, 600)).toBe(false);
		expect(shouldKeepSplitTheoryActive("control", false, 1_200)).toBe(false);
		expect(shouldKeepSplitTheoryActive("split", true, 1_200)).toBe(false);
	});

	it("switches to practice exactly when the final ten minutes begin", () => {
		expect(shouldTransitionToSplitPractice("split", false, 601, 600)).toBe(
			true,
		);
		expect(shouldTransitionToSplitPractice("split", false, 600, 599)).toBe(
			false,
		);
		expect(shouldTransitionToSplitPractice("split", true, 601, 600)).toBe(
			false,
		);
	});

	it("repeats only practice after a split session enters its final segment", () => {
		expect(
			getLearningSessionRepeatStartIndex(
				[{ phase: "theory" }, { phase: "theory" }, { phase: "practice" }],
				"split",
				false,
			),
		).toBe(2);
		expect(
			getLearningSessionRepeatStartIndex(
				[{ phase: "theory" }, { phase: "practice" }],
				"split",
				true,
			),
		).toBe(0);
	});
});
