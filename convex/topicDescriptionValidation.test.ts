import { describe, expect, test } from "vitest";
import { isMeaningfulTopicDescription } from "./topicDescriptionValidation";

describe("isMeaningfulTopicDescription", () => {
	test("accepts concrete exam topics", () => {
		for (const topic of ["Gedichtanalyse", "Zellteilung", "DNA", "Lyrik"])
			expect(isMeaningfulTopicDescription(topic)).toBe(true);
		expect(
			isMeaningfulTopicDescription("Lineare Funktionen und Gleichungen"),
		).toBe(true);
		expect(
			isMeaningfulTopicDescription("Subnetting, Netzadressen und Binärlogik"),
		).toBe(true);
	});

	test("rejects placeholders and gibberish", () => {
		expect(isMeaningfulTopicDescription("asdf asdf asdf")).toBe(false);
		expect(isMeaningfulTopicDescription("test test test")).toBe(false);
		expect(isMeaningfulTopicDescription("aaaa bbbb")).toBe(false);
		expect(isMeaningfulTopicDescription("Mathe")).toBe(false);
		expect(isMeaningfulTopicDescription("Mathematiktest")).toBe(false);
		expect(isMeaningfulTopicDescription("Mathe Arbeit")).toBe(false);
	});
});
