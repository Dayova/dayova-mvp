import { describe, expect, test } from "vitest";
import { shouldCloseDateTimePickerAfterChange } from "./date-time-picker-sheet.types";

describe("date-time picker sheet lifecycle", () => {
	test("lets Android finish selection in one transaction", () => {
		expect(shouldCloseDateTimePickerAfterChange("android")).toBe(true);
	});

	test("keeps the iOS spinner open until the user confirms", () => {
		expect(shouldCloseDateTimePickerAfterChange("ios")).toBe(false);
	});
});
