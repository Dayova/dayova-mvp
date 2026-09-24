import { expect, test } from "vitest";
import { correctSubjectName } from "./subject-definitions";

test.each([
	["  französisch  ", "Französisch"],
	["franzosisch", "Französisch"],
	["italienich", "Italienisch"],
	["matematik", "Mathematik"],
	["Spansich", "Spanisch"],
	["latein", "Latein"],
	["BWL", "BWL"],
	["Informatik LK", "Informatik LK"],
	["Darstellendes   Spiel", "Darstellendes Spiel"],
	["Robotik", "Robotik"],
	["", ""],
	["\t ", ""],
])("normalizes subject spelling: %s → %s", (input, expected) => {
	expect(correctSubjectName(input)).toBe(expected);
});
