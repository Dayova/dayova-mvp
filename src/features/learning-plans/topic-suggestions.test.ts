import { describe, expect, test } from "vitest";
import {
	appendTopicSuggestion,
	includesTopicSuggestion,
} from "./topic-suggestions";

describe("topic suggestions in a free exam scope", () => {
	test("preserves a long list and its conditions exactly when appending", () => {
		const text =
			"Analytische Geometrie ohne Hilfsmittel\r\n• Vektoren und ihre Beträge\n• Spiegeln an Ebenen und Achsen\n• Skalarprodukt und Winkel\n  ";
		expect(text.length).toBeGreaterThan(100);
		expect(appendTopicSuggestion(text, "Geraden")).toBe(`${text}\nGeraden`);
		expect(appendTopicSuggestion(`${text}\n`, "Geraden")).toBe(
			`${text}\nGeraden`,
		);
	});

	test("recognizes an existing exact entry in prose lists and bullet lists", () => {
		for (const text of [
			"Vektoren, Skalarprodukt; Winkel",
			"• skalarprodukt\nVektoren",
			"1. Skalarprodukt\n2. Vektoren",
		]) {
			expect(includesTopicSuggestion(text, "Skalarprodukt")).toBe(true);
			expect(appendTopicSuggestion(text, "Skalarprodukt")).toBe(text);
		}
	});

	test("does not equate a qualified skill or a substring with a catalog title", () => {
		expect(
			includesTopicSuggestion("Vektoren ohne Hilfsmittel", "Vektoren"),
		).toBe(false);
		expect(includesTopicSuggestion("Vektoren", "Vektor")).toBe(false);
		expect(appendTopicSuggestion("", "Evolution")).toBe("Evolution");
	});
});
