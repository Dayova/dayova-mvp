import { describe, expect, it } from "vitest";
import { getLearningPathFrame } from "./learning-path-layout";

describe("getLearningPathFrame", () => {
	it("keeps the Figma path unchanged when it fits", () => {
		expect(
			getLearningPathFrame({
				availableWidth: 345,
				pathHeight: 444,
				pathWidth: 345,
			}),
		).toEqual({ height: 444, scale: 1, width: 345 });
	});

	it("scales both layout dimensions for a narrow portrait viewport", () => {
		expect(
			getLearningPathFrame({
				availableWidth: 280,
				pathHeight: 444,
				pathWidth: 345,
			}),
		).toEqual({
			height: 444 * (280 / 345),
			scale: 280 / 345,
			width: 280,
		});
	});

	it("never grows the path above the Figma size", () => {
		expect(
			getLearningPathFrame({
				availableWidth: 720,
				pathHeight: 444,
				pathWidth: 345,
			}),
		).toEqual({ height: 444, scale: 1, width: 345 });
	});
});
