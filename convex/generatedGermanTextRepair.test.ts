import { describe, expect, test } from "vitest";
import { normalizeGeneratedGermanText } from "./generatedGermanText";
import { repairGeneratedGermanTextFromAsciiShadow } from "./generatedGermanTextRepair";

const repairAndNormalize = (value: string, asciiShadow: string) =>
	normalizeGeneratedGermanText(
		repairGeneratedGermanTextFromAsciiShadow(value, asciiShadow),
	);

describe("repairGeneratedGermanTextFromAsciiShadow", () => {
	test("repairs observed provider control markers from paired transliteration", () => {
		expect(
			repairAndNormalize(
				"Welche technischen Hilfsmittel k\u0004nnten f\u0004r eine Person mit Sehbeeintr\u0004chtigung n\u0004tzlich sein?",
				"Welche technischen Hilfsmittel koennten fuer eine Person mit Sehbeeintraechtigung nuetzlich sein?",
			),
		).toBe(
			"Welche technischen Hilfsmittel könnten für eine Person mit Sehbeeinträchtigung nützlich sein?",
		);
	});

	test("repairs German compounds and words with multiple damaged umlauts", () => {
		expect(
			repairAndNormalize(
				"Ger\u0004teklassen, L\u0004sungsans\u0004tze und Arbeitspl\u0004tze werden bez\u0004glich Pr\u0004fung verglichen.",
				"Geraeteklassen, Loesungsansaetze und Arbeitsplaetze werden bezueglich Pruefung verglichen.",
			),
		).toBe(
			"Geräteklassen, Lösungsansätze und Arbeitsplätze werden bezüglich Prüfung verglichen.",
		);
	});

	test("repairs arbitrary generated words without a dictionary or word list", () => {
		expect(
			repairAndNormalize(
				"M\u0004dchen vergleichen B\u0004cher in verschiedenen St\u0004dten.",
				"Maedchen vergleichen Buecher in verschiedenen Staedten.",
			),
		).toBe("Mädchen vergleichen Bücher in verschiedenen Städten.");
	});

	test("uses the paired transliteration to resolve ambiguous words", () => {
		expect(repairAndNormalize("Die K\u0004che ist modern.", "Die Kueche ist modern.")).toBe(
			"Die Küche ist modern.",
		);
		expect(
			repairAndNormalize(
				"Die K\u0004che planen den Ablauf.",
				"Die Koeche planen den Ablauf.",
			),
		).toBe("Die Köche planen den Ablauf.");
	});

	test("preserves clean German umlauts", () => {
		expect(
			repairAndNormalize(
				"Für Schüler könnten Geräte bezüglich Prüfung und Lösungen nützlich sein.",
				"Fuer Schueler koennten Geraete bezueglich Pruefung und Loesungen nuetzlich sein.",
			),
		).toBe(
			"Für Schüler könnten Geräte bezüglich Prüfung und Lösungen nützlich sein.",
		);
	});

	test("rejects mismatched paired transliteration instead of guessing", () => {
		expect(() =>
			repairAndNormalize(
				"Dieses Wort enth\u0004lt einen Marker.",
				"Dieses Wort enthaelt andere Werte.",
			),
		).toThrow("ungültige Sonderzeichen");
	});
});
