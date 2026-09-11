import { describe, expect, test } from "vitest";
import {
	getDateTimePickerConfirmAccessibilityLabel,
	shouldCloseDateTimePickerAfterChange,
} from "./date-time-picker-sheet.types";

describe("date-time picker sheet lifecycle", () => {
	test("lets Android finish selection in one transaction", () => {
		expect(shouldCloseDateTimePickerAfterChange("android")).toBe(true);
	});

	test("keeps the iOS spinner open until the user confirms", () => {
		expect(shouldCloseDateTimePickerAfterChange("ios")).toBe(false);
	});

	test("announces the same plain-text label that the confirmation button shows", () => {
		expect(getDateTimePickerConfirmAccessibilityLabel("Zeit übernehmen")).toBe(
			"Zeit übernehmen",
		);
		expect(getDateTimePickerConfirmAccessibilityLabel(null)).toBe(
			"Auswahl bestätigen",
		);
	});
});
