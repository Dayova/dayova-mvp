import { describe, expect, test } from "vitest";
import { formatGermanUiText } from "./german-ui-text";

describe("formatGermanUiText", () => {
	test("repairs transliterated German words without changing substrings", () => {
		expect(
			formatGermanUiText("Fuer Schueler: Loesungen und Uebungen zur Pruefung."),
		).toBe("Für Schüler: Lösungen und Übungen zur Prüfung.");
		expect(
			formatGermanUiText(
				"Geraete fuer grosse Strassen, aber Feuer bleibt Feuer.",
			),
		).toBe("Geräte für große Straßen, aber Feuer bleibt Feuer.");
	});
	test("preserves clean German umlauts before display", () => {
		expect(
			formatGermanUiText(
				"Für Schüler könnten Geräte bezüglich Prüfung und Lösungen nützlich sein.",
			),
		).toBe(
			"Für Schüler könnten Geräte bezüglich Prüfung und Lösungen nützlich sein.",
		);
	});
});
