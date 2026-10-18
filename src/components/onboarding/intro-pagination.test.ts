import { describe, expect, test } from "vitest";
import { getIntroDotWidth } from "./intro-pagination";

describe("intro pagination", () => {
	test("transfers the expanded width continuously between adjacent dots", () => {
		expect(getIntroDotWidth(0, 100, 0, 3)).toBe(30);
		expect(getIntroDotWidth(0, 100, 1, 3)).toBe(8);

		expect(getIntroDotWidth(50, 100, 0, 3)).toBe(19);
		expect(getIntroDotWidth(50, 100, 1, 3)).toBe(19);
		expect(getIntroDotWidth(50, 100, 2, 3)).toBe(8);

		expect(getIntroDotWidth(100, 100, 0, 3)).toBe(8);
		expect(getIntroDotWidth(100, 100, 1, 3)).toBe(30);
	});

	test("keeps the endpoint dot expanded outside the scroll range", () => {
		expect(getIntroDotWidth(-50, 100, 0, 3)).toBe(30);
		expect(getIntroDotWidth(250, 100, 2, 3)).toBe(30);
	});
});
