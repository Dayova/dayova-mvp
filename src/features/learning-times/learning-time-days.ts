const LEARNING_DAYS = [
	{ abbreviation: "Mo", label: "Montag", value: 1 },
	{ abbreviation: "Di", label: "Dienstag", value: 2 },
	{ abbreviation: "Mi", label: "Mittwoch", value: 3 },
	{ abbreviation: "Do", label: "Donnerstag", value: 4 },
	{ abbreviation: "Fr", label: "Freitag", value: 5 },
	{ abbreviation: "Sa", label: "Samstag", value: 6 },
	{ abbreviation: "So", label: "Sonntag", value: 7 },
] as const;

type LearningDayLabel = (typeof LEARNING_DAYS)[number]["label"];

export { LEARNING_DAYS };
export type { LearningDayLabel };
