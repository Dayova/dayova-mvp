import { describe, expect, test } from "vitest";
import {
	isThemePreference,
	resolveThemePreference,
	THEME_OPTIONS,
} from "./theme-preference";

describe("theme preference", () => {
	test("accepts the supported preference values", () => {
		expect(THEME_OPTIONS.map((option) => option.value)).toEqual([
			"light",
			"system",
			"dark",
		]);
		expect(isThemePreference("light")).toBe(true);
		expect(isThemePreference("dark")).toBe(true);
		expect(isThemePreference("system")).toBe(true);
		expect(isThemePreference("auto")).toBe(false);
		expect(isThemePreference(null)).toBe(false);
	});

	test("resolves system preference through the current system theme", () => {
		expect(resolveThemePreference("system", "light")).toBe("light");
		expect(resolveThemePreference("system", "dark")).toBe("dark");
		expect(resolveThemePreference("light", "dark")).toBe("light");
		expect(resolveThemePreference("dark", "light")).toBe("dark");
	});
});
