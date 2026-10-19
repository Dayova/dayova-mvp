import { describe, expect, test } from "vitest";
import { shouldUseKeyboardStickyActions } from "./keyboard-safe-scroll";

describe("getKeyboardSafeScrollConfig", () => {
	test("does not float action bars over scroll content on Android", () => {
		expect(shouldUseKeyboardStickyActions("android")).toBe(false);
		expect(shouldUseKeyboardStickyActions("ios")).toBe(true);
	});
});
