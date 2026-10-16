/** Provider search hints only. Never changes the learner's subject or its identity. */
const contextGroups = [
	[["mathematik", "mathe"], ["Mathematik"]],
	[["deutsch"], ["Deutsch"]],
	[["englisch"], ["Englisch"]],
	[["biologie", "bio"], ["Biologie"]],
	[["chemie"], ["Chemie"]],
	[["physik"], ["Physik", "Physik, Astronomie"]],
	[["geschichte"], ["Geschichte"]],
	[
		["erdkunde", "geografie", "geographie"],
		["Geografie", "Geographie"],
	],
	[
		["sozialkunde", "politik", "gemeinschaftskunde", "grw"],
		["Politik", "Gesellschaftskunde", "Politische Bildung"],
	],
	[["informatik"], ["Informatik"]],
	[["kunst"], ["Kunst"]],
	[["musik"], ["Musik"]],
	[["sport"], ["Sport"]],
	[["französisch"], ["Französisch"]],
	[["latein"], ["Latein"]],
	[["spanisch"], ["Spanisch"]],
	[["religion"], ["Religion"]],
	[
		["ethik", "philosophie"],
		["Philosophie & Ethik", "Philosophie und Ethik", "Philosophie", "Ethik"],
	],
	[
		[
			"wirtschaft",
			"wirtschaftskunde",
			"rechnungswesen",
			"buchhaltung",
			"bwl",
			"vwl",
		],
		[
			"Wirtschaftskunde",
			"Wirtschaft",
			"Betriebswirtschaftslehre",
			"Wirtschaft und Verwaltung",
		],
	],
	[
		["recht", "rechtskunde"],
		["Recht", "Rechtskunde", "Rechtswissenschaften"],
	],
] as const;

export const normalizeWloText = (value: string) =>
	value.normalize("NFC").trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");

const contexts = new Map<string, readonly string[]>(
	contextGroups.flatMap(([names, labels]) =>
		names.map((name) => [name, labels] as const),
	),
);

/** Recognizes explicit course markers; does not guess arbitrary abbreviations. */
export function resolveWloSubjectContext(subject: string): string[] {
	const name = normalizeWloText(subject)
		.replace(/^(?:lk|gk|leistungskurs|grundkurs)\s+/, "")
		.replace(
			/(?:\s*[-–]\s*|\s+|\s*\()(?:lk|gk|leistungskurs|grundkurs)(?:\s+\d{1,2})?\)?$/,
			"",
		);
	const exact = contexts.get(name);
	if (exact) return [...exact];
	const parts = name.split(/\s+(?:und|and)\s+|\s*[&/+]\s*/);
	if (parts.length < 2 || parts.some((part) => !contexts.has(part))) return [];
	return [...new Set(parts.flatMap((part) => contexts.get(part) ?? []))];
}
