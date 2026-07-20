import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";
import {
	fromMaterialDatePickerDate,
	toMaterialDatePickerIso,
} from "./android-material-date";
import { DAYOVA_DESIGN_SYSTEM } from "../../lib/design-system";

const require = createRequire(import.meta.url);
const { applyDayovaAndroidStyles } =
	require("../../../plugins/withDayovaAndroidTheme.js") as {
		applyDayovaAndroidStyles: (styles: AndroidStylesXml) => AndroidStylesXml;
	};
type AndroidStyleItem = { $: { name: string }; _: string };
type AndroidStylesXml = {
	resources: {
		style: Array<{
			$: { name: string; parent: string };
			item: AndroidStyleItem[];
		}>;
	};
};

describe("Android Material controls", () => {
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

	test("keep native Android fallback colors aligned with the design system", async () => {
		const previousAppVariant = process.env.APP_VARIANT;
		process.env.APP_VARIANT = "development";

		const appConfig = await import("../../../app.config")
			.then((module) => module.default)
			.finally(() => {
				if (previousAppVariant === undefined) {
					delete process.env.APP_VARIANT;
				} else {
					process.env.APP_VARIANT = previousAppVariant;
				}
			});

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
