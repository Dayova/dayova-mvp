import { describe, expect, test } from "vitest";
import {
	getCenteredIntroDotsTop,
	getIntroButtonProgress,
	getIntroDotWidth,
	getIntroInterpolatedValue,
	getIntroPageIndex,
	INTRO_DOT_COLLAPSED_WIDTH,
	INTRO_DOT_EXPANDED_WIDTH,
	INTRO_DOT_HEIGHT,
} from "./intro-pagination";

describe("intro pagination", () => {
	test("selects the nearest page while clamping both ends", () => {
		expect(getIntroPageIndex(-100, 100, 3)).toBe(0);
		expect(getIntroPageIndex(49, 100, 3)).toBe(0);
		expect(getIntroPageIndex(51, 100, 3)).toBe(1);
		expect(getIntroPageIndex(149, 100, 3)).toBe(1);
		expect(getIntroPageIndex(151, 100, 3)).toBe(2);
		expect(getIntroPageIndex(400, 100, 3)).toBe(2);
	});

	test("transfers the expanded width continuously between adjacent dots", () => {
		expect(getIntroDotWidth(0, 100, 0, 3)).toBe(INTRO_DOT_EXPANDED_WIDTH);
		expect(getIntroDotWidth(0, 100, 1, 3)).toBe(INTRO_DOT_COLLAPSED_WIDTH);

		expect(getIntroDotWidth(50, 100, 0, 3)).toBe(19);
		expect(getIntroDotWidth(50, 100, 1, 3)).toBe(19);
		expect(getIntroDotWidth(50, 100, 2, 3)).toBe(INTRO_DOT_COLLAPSED_WIDTH);

		expect(getIntroDotWidth(100, 100, 0, 3)).toBe(INTRO_DOT_COLLAPSED_WIDTH);
		expect(getIntroDotWidth(100, 100, 1, 3)).toBe(INTRO_DOT_EXPANDED_WIDTH);
	});

	test("keeps the endpoint dot expanded outside the scroll range", () => {
		expect(getIntroDotWidth(-50, 100, 0, 3)).toBe(INTRO_DOT_EXPANDED_WIDTH);
		expect(getIntroDotWidth(250, 100, 2, 3)).toBe(INTRO_DOT_EXPANDED_WIDTH);
	});

	test("interpolates control positions across neighboring pages", () => {
		const positions = [10, 20, 40];

		expect(getIntroInterpolatedValue(-50, 100, positions)).toBe(10);
		expect(getIntroInterpolatedValue(50, 100, positions)).toBe(15);
		expect(getIntroInterpolatedValue(150, 100, positions)).toBe(30);
		expect(getIntroInterpolatedValue(250, 100, positions)).toBe(40);
	});

	test("fills the next-button ring continuously across pages", () => {
		expect(getIntroButtonProgress(-50, 100, 3)).toBeCloseTo(1 / 3);
		expect(getIntroButtonProgress(0, 100, 3)).toBeCloseTo(1 / 3);
		expect(getIntroButtonProgress(50, 100, 3)).toBeCloseTo(1 / 2);
		expect(getIntroButtonProgress(100, 100, 3)).toBeCloseTo(2 / 3);
		expect(getIntroButtonProgress(200, 100, 3)).toBe(1);
		expect(getIntroButtonProgress(250, 100, 3)).toBe(1);
	});

	test("centers the dots between the title and button edges", () => {
		const titleBottom = 610.8;
		const buttonTop = 704;
		const dotsTop = getCenteredIntroDotsTop(
			titleBottom,
			buttonTop,
			INTRO_DOT_HEIGHT,
		);

		expect(dotsTop + INTRO_DOT_HEIGHT / 2).toBeCloseTo(
			(titleBottom + buttonTop) / 2,
		);
		expect(dotsTop - titleBottom).toBeCloseTo(
			buttonTop - (dotsTop + INTRO_DOT_HEIGHT),
		);
	});
});
