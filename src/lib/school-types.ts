export const SCHOOL_TYPE_OPTIONS = [
	{ value: "gymnasium", label: "Gymnasium" },
	{
		value: "secondary_general",
		label: "Oberschule / Realschule / Sekundarschule",
	},
	{
		value: "comprehensive",
		label: "Gesamt- / Gemeinschaftsschule",
	},
	{ value: "hauptschule", label: "Hauptschule" },
	{ value: "vocational", label: "Berufliche Schule" },
	{ value: "other", label: "Andere Schulart" },
	{ value: "prefer_not_to_say", label: "Keine Angabe" },
] as const;

export type SupportedSchoolType = (typeof SCHOOL_TYPE_OPTIONS)[number]["value"];

export const SCHOOL_TYPE_VALUES = SCHOOL_TYPE_OPTIONS.map(
	(option) => option.value,
) as readonly SupportedSchoolType[];

const SCHOOL_TYPE_VALUE_SET = new Set<string>(SCHOOL_TYPE_VALUES);

export const isSupportedSchoolType = (
	value: unknown,
): value is SupportedSchoolType =>
	typeof value === "string" && SCHOOL_TYPE_VALUE_SET.has(value);

const GENERIC_LEGACY_SCHOOL_TYPES: Readonly<
	Record<string, SupportedSchoolType>
> = {
	gymnasium: "gymnasium",
	oberschule: "secondary_general",
	realschule: "secondary_general",
	sekundarschule: "secondary_general",
	"oberschule / realschule / sekundarschule": "secondary_general",
	gesamtschule: "comprehensive",
	gemeinschaftsschule: "comprehensive",
	"gesamt- / gemeinschaftsschule": "comprehensive",
	hauptschule: "hauptschule",
	berufsschule: "vocational",
	"berufliche schule": "vocational",
	"andere schulart": "other",
	"keine angabe": "prefer_not_to_say",
};

export const normalizeLegacySchoolType = (
	value: unknown,
): SupportedSchoolType | undefined => {
	if (typeof value !== "string") return undefined;
	const normalizedValue = value.trim();
	if (isSupportedSchoolType(normalizedValue)) return normalizedValue;
	return GENERIC_LEGACY_SCHOOL_TYPES[normalizedValue.toLowerCase()];
};
