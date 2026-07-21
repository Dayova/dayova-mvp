export const FEDERAL_STATE_OPTIONS = [
	"Baden-Württemberg",
	"Bayern",
	"Berlin",
	"Brandenburg",
	"Bremen",
	"Hamburg",
	"Hessen",
	"Mecklenburg-Vorpommern",
	"Niedersachsen",
	"Nordrhein-Westfalen",
	"Rheinland-Pfalz",
	"Saarland",
	"Sachsen",
	"Sachsen-Anhalt",
	"Schleswig-Holstein",
	"Thüringen",
] as const;

export type SupportedFederalState = (typeof FEDERAL_STATE_OPTIONS)[number];

const FEDERAL_STATE_OPTION_SET = new Set<string>(FEDERAL_STATE_OPTIONS);

export const isSupportedFederalState = (
	value: unknown,
): value is SupportedFederalState =>
	typeof value === "string" && FEDERAL_STATE_OPTION_SET.has(value);
