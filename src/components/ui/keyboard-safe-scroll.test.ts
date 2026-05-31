import { describe, expect, test } from "vitest";
import {
	getKeyboardSafeScrollConfig,
	shouldUseKeyboardStickyActions,
} from "./keyboard-safe-scroll";

describe("getKeyboardSafeScrollConfig", () => {
	test("keeps focused inputs and multiline carets clear of the keyboard", () => {
		expect(getKeyboardSafeScrollConfig("ios", { bottomOffset: 28 })).toEqual({
			automaticallyAdjustKeyboardInsets: false,
			bottomOffset: 28,
			extraKeyboardSpace: 0,
			keyboardDismissMode: "interactive",
			keyboardShouldPersistTaps: "handled",
			mode: "layout",
			showsVerticalScrollIndicator: false,
		});

		expect(
			getKeyboardSafeScrollConfig("android", { bottomOffset: 28 }),
		).toEqual({
			automaticallyAdjustKeyboardInsets: false,
			bottomOffset: 28,
			extraKeyboardSpace: 0,
			keyboardDismissMode: "on-drag",
			keyboardShouldPersistTaps: "handled",
			mode: "layout",
			showsVerticalScrollIndicator: false,
		});
	});

	test("does not float action bars over scroll content on Android", () => {
		expect(shouldUseKeyboardStickyActions("android")).toBe(false);
		expect(shouldUseKeyboardStickyActions("ios")).toBe(true);
	});
});
