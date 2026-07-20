import { describe, expect, it } from "vitest";
import {
	CONTINUE_LEARNING_MINUTES,
	getLearningSessionCompletionPhase,
	getLearningSessionItems,
	isQualifiedSessionCompletion,
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
});
