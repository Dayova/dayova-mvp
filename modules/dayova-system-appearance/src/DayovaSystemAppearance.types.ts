export type DayovaSystemAppearanceModuleEvents = {
	onChange: (event: ColorSchemeChangeEvent) => void;
};

export type SystemColorScheme = "light" | "dark";

type ColorSchemeChangeEvent = {
	colorScheme: SystemColorScheme;
};
