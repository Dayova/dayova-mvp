import { describe, expect, test } from "vitest";
import { areSemanticallyDuplicateQuestions } from "./questionNovelty";

describe("question novelty", () => {
	test("rejects exact and punctuation-only repetitions", () => {
		expect(
			areSemanticallyDuplicateQuestions(
				"Erkläre die Steigung.",
				"Erkläre die Steigung!",
			),
		).toBe(true);
	});

	test("rejects number-swapped variants of the same task", () => {
		expect(
			areSemanticallyDuplicateQuestions(
				"Berechne die Steigung zwischen den Punkten 1, 2 und 3, 6.",
				"Bestimme die Steigung zwischen den Punkten 2, 4 und 4, 8.",
			),
		).toBe(true);
	});

	test("keeps genuinely different operations on one topic", () => {
		expect(
			areSemanticallyDuplicateQuestions(
				"Erkläre die Bedeutung der Steigung in einem Weg-Zeit-Diagramm.",
				"Berechne die Steigung zwischen zwei gegebenen Punkten.",
			),
		).toBe(false);
	});
});
