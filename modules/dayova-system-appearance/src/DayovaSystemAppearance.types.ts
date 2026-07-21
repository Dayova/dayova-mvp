export type DayovaSystemAppearanceModuleEvents = {
	onChange: (event: ColorSchemeChangeEvent) => void;
	onResume: (event: SnapshotShieldResumeEvent) => void;
};

export type SystemColorScheme = "light" | "dark";

type ColorSchemeChangeEvent = {
	colorScheme: SystemColorScheme;
};

type SnapshotShieldResumeEvent = {
	generation: number;
};
