import { describe, expect, test } from "vitest";
import { getLearningSessionKeyboardLayout } from "./session-keyboard-layout";

describe("getLearningSessionKeyboardLayout", () => {
	test("reserves the complete sticky action footer above the iOS keyboard", () => {
		expect(getLearningSessionKeyboardLayout("ios", 34)).toEqual({
			footerBottomPadding: 34,
			scrollBottomOffset: 106,
			stickyActionsEnabled: true,
		});
	});

	test("uses the measured footer height when scaled labels make it taller", () => {
		expect(getLearningSessionKeyboardLayout("ios", 34, 148)).toMatchObject({
			scrollBottomOffset: 148,
			stickyActionsEnabled: true,
		});
	});

	test("keeps Android actions in normal layout flow", () => {
		expect(getLearningSessionKeyboardLayout("android", 0)).toEqual({
			footerBottomPadding: 16,
			scrollBottomOffset: 24,
			stickyActionsEnabled: false,
		});
	});
});
