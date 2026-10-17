import { describe, expect, test } from "vitest";
import {
	matchesWloTitle,
	rankWloTopics,
	resolveWloSubjectContext,
} from "./wloSubjectContext";

describe("subject names as derived WLO search context", () => {
	test.each([
		"Mathematik",
		" Mathe LK ",
		"Mathe-LK",
		"Mathe (LK)",
		"LK Mathematik",
		"Mathematik GK 12",
	])("recognizes %s without changing the name", (name) => {
		expect(resolveWloSubjectContext(name)).toEqual(["Mathematik"]);
	});
	test.each([
		"Rechnungswesen",
		"Buchhaltung",
		"BWL",
	])("includes the observed Wirtschaftskunde category for %s", (name) => {
		expect(resolveWloSubjectContext(name)).toContain("Wirtschaftskunde");
	});
	test("combines known areas without creating a new subject", () => {
		const result = resolveWloSubjectContext("Wirtschaft und Recht");
		expect(result).toContain("Wirtschaftskunde");
		expect(result).toContain("Rechtswissenschaften");
		expect(new Set(result).size).toBe(result.length);
	});
	test.each([
		"Mein Spezialfach",
		"RW",
		"Mathematikdidaktik",
		"Wirtschaft und mein Kurs",
		"",
		"Lk",
	])("does not invent context for %s", (name) => {
		expect(resolveWloSubjectContext(name)).toEqual([]);
	});
	test("derives context again after a rename instead of retaining an old classification", () => {
		expect(resolveWloSubjectContext("Mathe LK")).toEqual(["Mathematik"]);
		expect(resolveWloSubjectContext("Rechnungswesen")).toContain(
			"Wirtschaftskunde",
		);
		expect(resolveWloSubjectContext("Unser Projekt")).toEqual([]);
	});
});

describe("topic title typing tolerance", () => {
	test.each([
		["Gedichts", "Gedichtanalyse"],
		["Gedichts", "Gedichte"],
		["Gedihct", "Gedichtanalyse"],
		["Rhetro", "Rhetorische Mittel"],
		["Vektr", "Vektoren"],
		["Gleichugn", "Lineare Gleichungen"],
	])("keeps %s related to %s", (query, title) => {
		expect(matchesWloTitle(title, query)).toBe(true);
	});
	test.each([
		["Gedichts", "Kreatives Schreiben"],
		["Butter", "Carbonsäuren"],
		["Bio", "Bilanz"],
		["Vektor", "Generator"],
		["Gedichts ohne", "Gedichtanalyse"],
	])("does not invent relevance for %s / %s", (query, title) => {
		expect(matchesWloTitle(title, query)).toBe(false);
	});
	test("uses the same fuzzy title and subject ranking for cached previews", () => {
		const topics = [
			{ title: "Gedichte", subjects: ["Englisch"] },
			{ title: "Kreatives Schreiben", subjects: ["Deutsch"] },
			{ title: "Gedichtanalyse", subjects: ["Deutsch"] },
		];
		expect(
			rankWloTopics(topics, "Gedichts", "Deutsch").map((topic) => topic.title),
		).toEqual(["Gedichtanalyse", "Gedichte"]);
	});
});
