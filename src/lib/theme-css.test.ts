import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { DAYOVA_DESIGN_SYSTEM } from "./design-system";
import { DARK_THEME_COLORS, DARK_THEME_VARIABLES } from "./theme-variables";

const GLOBAL_CSS_PATH = resolve(process.cwd(), "src/global.css");

describe("theme CSS", () => {
	test("outlined danger labels retain AA contrast, including pressed opacity in both themes", () => {
		const luminance = (hex: string) => {
			const rgb = [1, 3, 5].map((offset) => {
				const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
				return value <= 0.04045
					? value / 12.92
					: ((value + 0.055) / 1.055) ** 2.4;
			});
			return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
		};
		for (const colors of [DAYOVA_DESIGN_SYSTEM.colors, DARK_THEME_COLORS]) {
			for (const opacity of [1, 0.8]) {
				for (const background of [colors.background, colors.surface]) {
					const composite = (foreground: string) =>
						`#${[1, 3, 5]
							.map((offset) =>
								Math.round(
									Number.parseInt(foreground.slice(offset, offset + 2), 16) *
										opacity +
										Number.parseInt(background.slice(offset, offset + 2), 16) *
											(1 - opacity),
								)
									.toString(16)
									.padStart(2, "0"),
							)
							.join("")}`;
					const values = [colors.dangerAction, colors.dangerSubtle]
						.map((color) => luminance(composite(color)))
						.sort((a, b) => a - b);
					expect(
						(values[1] + 0.05) / (values[0] + 0.05),
					).toBeGreaterThanOrEqual(4.5);
				}
			}
		}
	});

	test("keeps the native runtime dark variables synchronized with CSS", () => {
		const css = readFileSync(GLOBAL_CSS_PATH, "utf8");
		const darkRoot = css.match(/\.dark:root\s*\{([^}]+)\}/)?.[1];
		expect(darkRoot).toBeDefined();

		const cssVariables = Object.fromEntries(
			[...(darkRoot ?? "").matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
				([, name, value]) => [name, value],
			),
		);

		expect(DARK_THEME_VARIABLES).toEqual(cssVariables);
	});
});
