export const GERMAN_FEDERAL_STATES = [
	"Bremen",
	"Hamburg",
	"Baden-Württemberg",
	"Sachsen",
	"Sachsen-Anhalt",
	"Brandenburg",
	"Bayern",
	"Berlin",
	"Hessen",
	"Niedersachsen",
	"Nordrhein-Westfalen",
	"Rheinland-Pfalz",
	"Saarland",
	"Schleswig-Holstein",
	"Thüringen",
	"Mecklenburg-Vorpommern",
] as const;

export type GermanFederalState = (typeof GERMAN_FEDERAL_STATES)[number];

const GERMAN_FEDERAL_STATE_SET = new Set<string>(GERMAN_FEDERAL_STATES);

export const isGermanFederalState = (
	value: unknown,
): value is GermanFederalState =>
	typeof value === "string" && GERMAN_FEDERAL_STATE_SET.has(value);
