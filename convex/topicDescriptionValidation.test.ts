import { describe, expect, test } from "vitest";
import { isMeaningfulTopicDescription } from "./topicDescriptionValidation";

describe("isMeaningfulTopicDescription", () => {
	test("accepts concrete exam topics", () => {
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
	});
});
