import { describe, expect, test } from "vitest";
import { appendExamHint, getExamHintExamples } from "./exam-hint-examples";

describe("reviewed contextual hint examples", () => {
	test("keeps math and German examples separate and responds to explicit topics", () => {
		expect(getExamHintExamples("Mathe LK", ["Vektoren"])).toEqual([
			"Ohne Taschenrechner",
			"Lösungsweg angeben",
			"Skizzen beschriften",
		]);
		expect(getExamHintExamples("Mathe", ["Brüche"])).not.toContain(
			"Skizzen beschriften",
		);
		expect(getExamHintExamples("Deutsch", ["Gedichtanalyse"])).toEqual([
			"Textbelege mit Zeilenangaben",
			"Nur die behandelten Kapitel",
		]);
	});
	test("supports personal accounting, combined subjects and neutral unknown subjects", () => {
		expect(getExamHintExamples("Rechnungswesen", ["Bilanz"])).toContain(
			"Buchungssätze mit Kontonummern angeben",
		);
		expect(getExamHintExamples("Wirtschaft und Recht", ["Bilanz"])).toContain(
			"Buchungssätze mit Kontonummern angeben",
		);
		expect(getExamHintExamples("Mein Projektfach", ["Vektoren"])).toEqual([]);
		expect(getExamHintExamples("Deutsch", ["Bilanz"])).not.toContain(
			"Ohne Taschenrechner",
		);
	});
	test("never rewrites scoped instructions or silently changes no aids into no calculator", () => {
		const original =
			" Analysis ohne Taschenrechner, Stochastik mit Formelsammlung.\nOhne Hilfsmittel ";
		expect(appendExamHint(original, "Ohne Taschenrechner")).toBe(
			`${original}\nOhne Taschenrechner`,
		);
		expect(appendExamHint(original, "  OHNE HILFSMITTEL  ")).toBe(original);
		expect(appendExamHint(original, " ")).toBe(original);
	});
});
