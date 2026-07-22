import { describe, expect, test } from "vitest";
import {
	getCenteredQuestionRegionCenter,
	getCenteredQuestionRegionHeight,
	getQuestionContentWidth,
	getStableViewportHeight,
} from "./session-content-layout";

describe("session content layout", () => {
	test.each([
		[812, 556],
		[852, 596],
		[874, 618],
	])("centers the question region in a %i point viewport", (viewportHeight, expectedRegionHeight) => {
		expect(getCenteredQuestionRegionHeight(viewportHeight)).toBe(
			expectedRegionHeight,
		);
	});

	test("lets very short viewports fall back to natural content height", () => {
		expect(getCenteredQuestionRegionHeight(240)).toBe(0);
	});

	test("centers the reference region on the Figma viewport", () => {
		expect(getCenteredQuestionRegionCenter(852)).toBe(426);
	});

	test.each([
		[375, 327],
		[393, 345],
		[402, 345],
		[768, 345],
	])("uses a responsive, capped question width in a %i point viewport", (viewportWidth, expectedContentWidth) => {
		expect(getQuestionContentWidth(viewportWidth)).toBe(expectedContentWidth);
	});

	test("ignores only keyboard-driven viewport height reductions", () => {
		expect(getStableViewportHeight(874, 512, true)).toBe(874);
		expect(getStableViewportHeight(874, 512, false)).toBe(512);
		expect(getStableViewportHeight(812, 874, false)).toBe(874);
	});
});
