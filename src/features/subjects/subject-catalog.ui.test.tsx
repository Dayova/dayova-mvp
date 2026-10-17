import { expect, jest, test } from "@jest/globals";
import {
	BookOpen,
	Code,
	Language,
	Sparkles,
	Telescope,
} from "~/components/ui/icon";
import { getSubjectIcon } from "./subject-catalog";

jest.mock("~/components/ui/icon", () =>
	Object.fromEntries(
		[
			"BookOpen",
			"Calculator",
			"Chemistry",
			"Code",
			"Dna",
			"Earth",
			"Football",
			"Language",
			"Maps",
			"Mic",
			"MusicNote",
			"PaintBrush",
			"Pencil",
			"TimeManagement",
			"Telescope",
			"Sparkles",
			"Plant",
			"Bulb",
			"CreditCard",
		].map((name) => [name, jest.fn()]),
	),
);
test("selects matching symbols for custom subjects and course suffixes", () => {
	expect(getSubjectIcon("  ASTROLOGIE  ")).toBe(Sparkles);
	expect(getSubjectIcon("Astronomie AG")).toBe(Telescope);
	expect(getSubjectIcon("Französisch LK")).toBe(Language);
	expect(getSubjectIcon("Programmierung")).toBe(Code);
	expect(getSubjectIcon("Informatik 10")).toBe(Code);
});
test("retains a book for unknown subjects rather than matching arbitrary substrings", () => {
	expect(getSubjectIcon("Mein Projekt")).toBe(BookOpen);
	expect(getSubjectIcon("Musiktherapieforschung")).toBe(BookOpen);
});
