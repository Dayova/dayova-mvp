import { describe, expect, test } from "vitest";
import { appendExamHint, getExamHintExamples } from "./exam-hint-examples";

describe("reviewed contextual hint examples", () => {
	test("ranks selected topics before subject fallbacks", () => {
		const geometry = getExamHintExamples("Mathe LK", ["Vektoren"]);
		expect(geometry).toContain("Skizzen beschriften");
		expect(geometry.indexOf("Skizzen beschriften")).toBeLessThan(
			geometry.indexOf("Ohne Taschenrechner"),
		);
		expect(getExamHintExamples("Mathe", ["Brüche"])).not.toContain(
			"Skizzen beschriften",
		);
		const poetry = getExamHintExamples("Deutsch", ["Gedichtanalyse"]);
		expect(poetry[0]).toBe("Versangaben verwenden");
		expect(poetry).not.toContain("Ohne Taschenrechner");
		expect(poetry).not.toContain("Erzählperspektive berücksichtigen");
	});
	test("handles aliases, multiple topics, umlauts and unknown subjects", () => {
		expect(getExamHintExamples("Wirtschaft und Recht", ["Bilanz"])[0]).toBe(
			"Buchungssätze mit Kontonummern angeben",
		);
		expect(getExamHintExamples("Rechnungswesen", ["Buchungssätze"])).toContain(
			"Soll und Haben kennzeichnen",
		);
		expect(getExamHintExamples("Mathe LK", ["Brueche", "Vektoren"])).toEqual(
			expect.arrayContaining([
				"Brüche vollständig kürzen",
				"Skizzen beschriften",
			]),
		);
		expect(getExamHintExamples("Mein Projektfach", ["Vektoren"])).toContain(
			"Skizzen beschriften",
		);
		expect(getExamHintExamples("Mein Projektfach", ["Unbekannt"])).toEqual([]);
		expect(getExamHintExamples("Deutsch", ["Bilanz"])).not.toContain(
			"Buchungssätze mit Kontonummern angeben",
		);
		expect(
			getExamHintExamples("Biologie", ["Allgemeine Grundlagen"]),
		).not.toContain("Kreuzungsschema angeben");
	});
	test("searches the full catalog before limiting results, including aliases", () => {
		expect(
			getExamHintExamples("Deutsch", ["Gedichtanalyse"], "rechner"),
		).toContain("Ohne Taschenrechner");
		expect(getExamHintExamples("Mathematik", ["Brüche"], "SQL")).toContain(
			"SQL-Abfragen angeben",
		);
		expect(getExamHintExamples("Mathematik", [], "OHiMi")).toEqual([
			"Ohne Hilfsmittel",
		]);
		expect(getExamHintExamples("Mathematik", [], "Formelblatt")).toContain(
			"Formelsammlung erlaubt",
		);
		expect(
			getExamHintExamples("Deutsch", [], "  TEXTBELEGE   ZEILEN "),
		).toEqual(["Textbelege mit Zeilenangaben"]);
		expect(getExamHintExamples("Deutsch", [], "unbekannter hinweis")).toEqual(
			[],
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
