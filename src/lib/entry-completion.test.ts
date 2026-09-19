import { describe, expect, test } from "vitest";
import { getEntryCompletionAction } from "./entry-completion";

describe("getEntryCompletionAction", () => {
	test("describes the transition to completed", () => {
		expect(getEntryCompletionAction(false)).toEqual({
			buttonLabel: "Als erledigt markieren",
			nextCompleted: true,
			successMessage: "Als erledigt markiert.",
		});
	});

	test("describes the transition back to open", () => {
		expect(getEntryCompletionAction(true)).toEqual({
			buttonLabel: "Als offen markieren",
			nextCompleted: false,
			successMessage: "Als offen markiert.",
		});
	});
});
