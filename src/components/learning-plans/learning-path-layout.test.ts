import { describe, expect, test } from "vitest";
import {
	getCurrentLearningPathIndex,
	getLearningPathHeight,
	getLearningPathNodeFrame,
	getLearningPathNodeState,
	LEARNING_PATH_WIDTH,
} from "./learning-path-layout";

describe("learning path layout", () => {
	test("moves nodes through a repeating center-left-center-right wave", () => {
		const centers = Array.from({ length: 9 }, (_, index) => {
			const frame = getLearningPathNodeFrame(index);
			return frame.left + frame.width / 2;
		});

		expect(centers[0]).toBe(LEARNING_PATH_WIDTH / 2);
		expect(centers[2]).toBeLessThan(centers[1] ?? 0);
		expect(centers[4]).toBe(LEARNING_PATH_WIDTH / 2);
		expect(centers[6]).toBeGreaterThan(centers[5] ?? 0);
		expect(centers[8]).toBe(LEARNING_PATH_WIDTH / 2);
	});

	test("gives every node increasing vertical space", () => {
		const first = getLearningPathNodeFrame(0);
		const second = getLearningPathNodeFrame(1);
		const fifth = getLearningPathNodeFrame(4);

		expect(second.top).toBeGreaterThan(first.top + first.height);
		expect(fifth.top).toBeGreaterThan(second.top);
		expect(getLearningPathHeight(5)).toBeGreaterThan(fifth.top + fifth.height);
	});
});

describe("learning path state", () => {
	test("selects the first incomplete session as current", () => {
		expect(
			getCurrentLearningPathIndex([
				{ completed: true },
				{ completed: false },
				{ completed: false },
			]),
		).toBe(1);
	});

	test("marks completed, current, and future sessions", () => {
		expect(getLearningPathNodeState({ completed: true }, 0, 1)).toBe(
			"completed",
		);
		expect(getLearningPathNodeState({ completed: false }, 1, 1)).toBe(
			"current",
		);
		expect(getLearningPathNodeState({ completed: false }, 2, 1)).toBe("locked");
	});
});
