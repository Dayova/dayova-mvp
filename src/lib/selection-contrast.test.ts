import { expect, test } from "vitest";
import { DAYOVA_DESIGN_SYSTEM } from "./design-system";

function channels(hex: string) {
	return [1, 3, 5].map(
		(offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
	);
}

function luminance(rgb: number[]) {
	return rgb.reduce((sum, channel, index) => {
		const linear =
			channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
		return sum + linear * [0.2126, 0.7152, 0.0722][index];
	}, 0);
}

test("white selection glyphs retain small-text contrast across the gradient", () => {
	const stops = DAYOVA_DESIGN_SYSTEM.gradients.selection.colors.map(channels);
	const foreground = luminance(channels(DAYOVA_DESIGN_SYSTEM.colors.light1));
	for (let stop = 0; stop < stops.length - 1; stop++) {
		for (let sample = 0; sample <= 100; sample++) {
			const amount = sample / 100;
			const background = luminance(
				stops[stop].map(
					(channel, index) =>
						channel + (stops[stop + 1][index] - channel) * amount,
				),
			);
			const contrast =
				(Math.max(foreground, background) + 0.05) /
				(Math.min(foreground, background) + 0.05);
			expect(contrast).toBeGreaterThanOrEqual(4.5);
		}
	}
});
