import { describe, expect, test } from "vitest";
import {
	BUILT_IN_SUBJECT_NAMES,
	cleanSubjectName,
	normalizeSubjectName,
} from "./subject-definitions";

describe("subject catalog", () => {
	test("keeps French, Latin, and Spanish out of the default list", () => {
		expect(BUILT_IN_SUBJECT_NAMES).not.toContain("Französisch");
		expect(BUILT_IN_SUBJECT_NAMES).not.toContain("Latein");
		expect(BUILT_IN_SUBJECT_NAMES).not.toContain("Spanisch");
	});

	test("normalizes casing and surrounding whitespace for duplicate checks", () => {
		expect(cleanSubjectName("  Darstellendes   Spiel ")).toBe(
			"Darstellendes Spiel",
		);
		expect(normalizeSubjectName("  FRANZÖSISCH ")).toBe("französisch");
	});
});
