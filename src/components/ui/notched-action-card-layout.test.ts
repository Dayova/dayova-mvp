import { describe, expect, test } from "vitest";
import { resolveNotchedCardFrameHeight } from "./notched-action-card-layout";

describe("resolveNotchedCardFrameHeight", () => {
	test("preserves the approved card height when content fits", () => {
		expect(
			resolveNotchedCardFrameHeight({
				measuredContentHeight: 198,
				minimumHeight: 211,
			}),
		).toBe(211);
	});

	test("grows the decorative frame with enlarged content", () => {
		expect(
			resolveNotchedCardFrameHeight({
				measuredContentHeight: 286,
				minimumHeight: 211,
			}),
		).toBe(286);
	});

	test("ignores an unavailable initial measurement", () => {
		expect(
			resolveNotchedCardFrameHeight({
				measuredContentHeight: 0,
				minimumHeight: 144,
			}),
		).toBe(144);
	});
});
