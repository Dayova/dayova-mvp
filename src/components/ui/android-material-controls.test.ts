import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import appConfig from "../../../app.config";
import {
	fromMaterialDatePickerDate,
	toMaterialDatePickerIso,
} from "./android-material-date";
import { DAYOVA_DESIGN_SYSTEM } from "../../lib/design-system";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "../../..");
const require = createRequire(import.meta.url);
const { applyDayovaAndroidStyles } =
	require("../../../plugins/withDayovaAndroidTheme.js") as {
		applyDayovaAndroidStyles: (styles: AndroidStylesXml) => AndroidStylesXml;
	};
const androidPickerPath = resolve(
	testDirectory,
	"date-time-picker-sheet.android.tsx",
);
const androidPickerSource = existsSync(androidPickerPath)
	? readFileSync(androidPickerPath, "utf8")
	: "";

type AndroidStyleItem = { $: { name: string }; _: string };
type AndroidStylesXml = {
	resources: {
		style: Array<{
			$: { name: string; parent: string };
			item: AndroidStyleItem[];
		}>;
	};
};

function collectAndroidSourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return collectAndroidSourceFiles(path);
		return extname(entry.name) === ".tsx" && entry.name.endsWith(".android.tsx")
			? [path]
			: [];
	});
}

describe("Android Material controls", () => {
	test("seed every app-owned Compose host with the Dayova palette", () => {
		const composeHostFiles = collectAndroidSourceFiles(
			resolve(projectRoot, "src"),
		).filter((path) => {
			const source = readFileSync(path, "utf8");
			return (
				source.includes('from "@expo/ui/jetpack-compose"') &&
				source.includes("<Host")
			);
		});

		expect(composeHostFiles.length).toBeGreaterThan(0);
		for (const path of composeHostFiles) {
			const source = readFileSync(path, "utf8");
			const hostTags = source.match(/<Host\b[^>]*>/gs) ?? [];
			expect(hostTags.length, path).toBeGreaterThan(0);
			for (const hostTag of hostTags) {
				expect(hostTag, path).toContain("seedColor={DAYOVA_PRIMARY}");
				expect(hostTag, path).toContain("colorScheme={resolvedTheme}");
			}
		}
	});

	test("render date and time dialogs inside a Dayova-themed Android host", () => {
		expect(existsSync(androidPickerPath)).toBe(true);
		expect(androidPickerSource).not.toContain(
			"@expo/ui/community/datetime-picker",
		);
		expect(androidPickerSource).toContain("DatePickerDialog");
		expect(androidPickerSource).toContain("TimePickerDialog");
		expect(androidPickerSource).toContain("seedColor={DAYOVA_PRIMARY}");
		expect(androidPickerSource).toContain("colorScheme={resolvedTheme}");
		expect(androidPickerSource).toContain('mode !== "datetime"');
	});

	test("keep Material calendar days stable across local time zones", () => {
		const localDate = new Date(2012, 8, 9, 16, 44, 12, 34);

		expect(toMaterialDatePickerIso(localDate)).toBe("2012-09-09T00:00:00.000Z");

		const restoredDate = fromMaterialDatePickerDate(
			new Date("2012-09-09T00:00:00.000Z"),
			localDate,
		);
		expect([
			restoredDate.getFullYear(),
			restoredDate.getMonth(),
			restoredDate.getDate(),
			restoredDate.getHours(),
			restoredDate.getMinutes(),
			restoredDate.getSeconds(),
			restoredDate.getMilliseconds(),
		]).toEqual([2012, 8, 9, 16, 44, 12, 34]);
	});

	test("keep native Android fallback colors aligned with the design system", () => {
		const pluginNames = (appConfig.plugins ?? []).map((plugin) =>
			Array.isArray(plugin) ? plugin[0] : plugin,
		);
		const primary = DAYOVA_DESIGN_SYSTEM.colors.primary;

		expect(appConfig.primaryColor).toBe(primary);
		expect(pluginNames).toContain("./plugins/withDayovaAndroidTheme");

		const themedStyles = applyDayovaAndroidStyles({
			resources: {
				style: [
					{
						$: {
							name: "AppTheme",
							parent: "Theme.AppCompat.DayNight.NoActionBar",
						},
						item: [],
					},
				],
			},
		});
		const appTheme = themedStyles.resources.style.find(
			(style) => style.$.name === "AppTheme",
		);
		const themeItems = Object.fromEntries(
			(appTheme?.item ?? []).map((item) => [item.$.name, item._]),
		);

		for (const item of [
			"colorAccent",
			"android:colorAccent",
			"colorControlActivated",
			"android:colorControlActivated",
		]) {
			expect(themeItems[item]).toBe("@color/colorPrimary");
		}
	});
});
