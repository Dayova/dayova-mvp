import { describe, expect, test } from "vitest";
import {
	createTheoryCardQueue,
	repeatCurrentTheoryCard,
	understandCurrentTheoryCard,
} from "./theory-card-queue";

describe("theory card queue", () => {
	test("repeating a card appends it to the end and advances", () => {
		const queue = createTheoryCardQueue(["card-1", "card-2", "card-3"]);

		const next = repeatCurrentTheoryCard(queue);

		expect(next).toEqual({
			queue: ["card-1", "card-2", "card-3", "card-1"],
			currentIndex: 1,
		});
	});

	test("understanding every queued card completes the theory session", () => {
		const first = understandCurrentTheoryCard(
			createTheoryCardQueue(["card-1", "card-2"]),
		);
		const second = understandCurrentTheoryCard(first.state);

		expect(first.isComplete).toBe(false);
		expect(first.state.currentIndex).toBe(1);
		expect(second.isComplete).toBe(true);
	});
});
