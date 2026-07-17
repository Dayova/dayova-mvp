import { describe, expect, it } from "vitest";
import {
	getOtpCellLayout,
	getRangeValueBadgeSize,
	getResponsiveAuthChoiceLayout,
} from "./auth-content-size-layout";

describe("auth content-size layout", () => {
	it("preserves the original default-size control geometry", () => {
		expect(
			getOtpCellLayout({
				fontScale: 1,
				shouldStackInlineContent: false,
			}),
		).toEqual({ height: 42 });
		expect(
			getRangeValueBadgeSize({
				fontScale: 1,
				shouldStackInlineContent: false,
			}),
		).toBe(88);
	});

	it("gives maximum-size OTP digits enough space and exceeds the compact row width", () => {
		const layout = getOtpCellLayout({
			fontScale: 3,
			shouldStackInlineContent: true,
		});

		expect(layout).toEqual({ height: 98, width: 82 });
		expect((layout.width ?? 0) * 6 + 8 * 5).toBeGreaterThan(280);
	});

	it("keeps both maximum-size range badge lines inside the ring stroke", () => {
		const fontScale = 3;
		const scaledTextHeight = (36 + 15) * fontScale - 4;
		const ringStrokeWidth = 4;
		const innerVerticalPadding = 12;
		const badgeSize = getRangeValueBadgeSize({
			fontScale,
			shouldStackInlineContent: true,
		});

		expect(badgeSize).toBe(181);
		expect(badgeSize - scaledTextHeight).toBeGreaterThanOrEqual(
			2 * (ringStrokeWidth + innerVerticalPadding),
		);
	});

	it("keeps maximum-size auth copy readable while capping decorative branding", () => {
		expect(getResponsiveAuthChoiceLayout(3)).toEqual({
			brandFontSize: 48,
			brandLineHeight: 72,
			bodyFontSize: 48,
			bodyLineHeight: 72,
			buttonMinHeight: 96,
			termsFontSize: 36,
			termsLineHeight: 54,
			verticallyCenterContent: false,
		});
	});
});
