export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "dayova.theme";

export const THEME_OPTIONS: Array<{
	value: ThemePreference;
	label: string;
	accessibilityLabel: string;
}> = [
	{
		value: "light",
		label: "Hell",
		accessibilityLabel: "Helles Design verwenden",
	},
	{
		value: "system",
		label: "System",
		accessibilityLabel: "Systemdesign verwenden",
	},
	{
		value: "dark",
		label: "Dunkel",
		accessibilityLabel: "Dunkles Design verwenden",
	},
];

export function isThemePreference(value: unknown): value is ThemePreference {
	return value === "light" || value === "dark" || value === "system";
}

export function resolveThemePreference(
	preference: ThemePreference,
	systemTheme: ResolvedTheme,
): ResolvedTheme {
	return preference === "system" ? systemTheme : preference;
}
