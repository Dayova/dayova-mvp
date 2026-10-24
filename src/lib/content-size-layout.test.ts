import { describe, expect, test } from "vitest";
import { getContentSizeLayout } from "./content-size-layout";

describe("getContentSizeLayout", () => {
	test("preserves the approved 393-point phone baseline", () => {
		expect(
			getContentSizeLayout({
				fontScale: 1,
				viewportWidth: 393,
			}),
		).toEqual({
			containerMaxWidth: 480,
			horizontalPadding: 32,
			shouldStackInlineContent: false,
			usableWidth: 329,
		});
	});

	test("protects usable width on compact and display-zoomed phones", () => {
		expect(
			getContentSizeLayout({
				fontScale: 1,
				viewportWidth: 320,
			}),
		).toEqual({
			containerMaxWidth: 480,
			horizontalPadding: 20,
			shouldStackInlineContent: true,
			usableWidth: 280,
		});

		expect(
			getContentSizeLayout({
				fontScale: 1,
				viewportWidth: 280,
			}),
		).toEqual({
			containerMaxWidth: 480,
			horizontalPadding: 16,
			shouldStackInlineContent: true,
			usableWidth: 248,
		});
	});

	test("keeps portrait tablets in a centered readable phone composition", () => {
		expect(
			getContentSizeLayout({
				fontScale: 1,
				viewportWidth: 768,
			}),
		).toEqual({
			containerMaxWidth: 480,
			horizontalPadding: 32,
			shouldStackInlineContent: false,
			usableWidth: 416,
		});
	});

	test("stacks inline content when system text is enlarged", () => {
		expect(
			getContentSizeLayout({
				fontScale: 1.3,
				viewportWidth: 393,
			}),
		).toMatchObject({
			horizontalPadding: 20,
			shouldStackInlineContent: true,
			usableWidth: 353,
		});
	});

	test("respects a screen's existing padding and readable-width cap", () => {
		expect(
			getContentSizeLayout({
				containerMaxWidth: 560,
				fontScale: 1,
				requestedHorizontalPadding: 24,
				viewportWidth: 1024,
			}),
		).toEqual({
			containerMaxWidth: 560,
			horizontalPadding: 24,
			shouldStackInlineContent: false,
			usableWidth: 512,
		});
	});
});
