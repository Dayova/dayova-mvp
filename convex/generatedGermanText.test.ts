import { describe, expect, test } from "vitest";
import { normalizeGeneratedGermanText } from "./generatedGermanText";

describe("normalizeGeneratedGermanText", () => {
	test("preserves clean German umlauts", () => {
		expect(
			normalizeGeneratedGermanText(
				"Für Schüler könnten Geräte bezüglich Prüfung und Lösungen nützlich sein.",
			),
		).toBe(
			"Für Schüler könnten Geräte bezüglich Prüfung und Lösungen nützlich sein.",
		);
	});

	test("keeps existing German transliteration cleanup working", () => {
		expect(
			normalizeGeneratedGermanText(
				"Schueler sollen Loesungen fuer die Pruefung mit grossen Uebungen pruefen.",
			),
		).toBe(
			"Schüler sollen Lösungen für die Prüfung mit großen Übungen prüfen.",
		);
	});

	test("rejects provider control markers instead of guessing missing umlauts", () => {
		expect(() =>
			normalizeGeneratedGermanText(
				"Welche technischen Hilfsmittel k\u0004nnten f\u0004r Personen mit Sehbeeintr\u0004chtigung n\u0004tzlich sein?",
			),
		).toThrow("ungültige Sonderzeichen");
	});

	test("rejects any unresolved control characters in generated display text", () => {
		expect(() =>
			normalizeGeneratedGermanText(
				"Dieses Wort enth\u0004lt einen unbekannten Marker.",
			),
		).toThrow("ungültige Sonderzeichen");
	});
});
