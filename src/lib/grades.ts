export const GRADE_OPTIONS = [
	"6",
	"7",
	"8",
	"9",
	"10",
	"11",
	"12",
	"13",
] as const;

export type SupportedGrade = (typeof GRADE_OPTIONS)[number];

const GRADE_OPTION_SET = new Set<string>(GRADE_OPTIONS);

export const isSupportedGrade = (value: unknown): value is SupportedGrade =>
	typeof value === "string" && GRADE_OPTION_SET.has(value);
