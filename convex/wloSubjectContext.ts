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

export const normalizeWloQuery = (value: string) =>
	normalizeWloText(value).replace(/gedichtsanalyse/g, "gedichtanalyse");

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

/** One edit in a word prefix tolerates typing slips without accepting description-only hits.
 * Short queries stay literal so broad three-letter searches remain predictable. */
export function matchesWloTitle(title: string, query: string): boolean {
	const term = normalizeWloQuery(query);
	const name = normalizeWloText(title);
	if (name.includes(term)) return true;
	if (!/^[a-zäöüß]{5,40}$/u.test(term)) return false;
	return name.split(/[^a-zäöüß]+/u).some((word) =>
		[term.length - 1, term.length, term.length + 1].some((length) => {
			if (word.length < length) return false;
			const prefix = word.slice(0, length);
			let i = 0;
			while (i < Math.min(term.length, prefix.length) && term[i] === prefix[i])
				i++;
			if (term.length === prefix.length) {
				return (
					term.slice(i + 1) === prefix.slice(i + 1) ||
					(term[i] === prefix[i + 1] &&
						term[i + 1] === prefix[i] &&
						term.slice(i + 2) === prefix.slice(i + 2))
				);
			}
			return term.length > prefix.length
				? term.slice(i + 1) === prefix.slice(i)
				: term.slice(i) === prefix.slice(i + 1);
		}),
	);
}

/** Same ranking for fresh provider results and provisional known title matches. */
export function rankWloTopics<T extends { title: string; subjects?: string[] }>(
	topics: readonly T[],
	query: string,
	subject: string,
) {
	const term = normalizeWloQuery(query);
	const context = resolveWloSubjectContext(subject).map(normalizeWloText);
	const rank = (title: string) =>
		normalizeWloText(title) === term
			? 0
			: normalizeWloText(title).startsWith(term)
				? 1
				: normalizeWloText(title).includes(term)
					? 2
					: 3;
	return topics
		.filter((topic) => matchesWloTitle(topic.title, term))
		.map((topic) => ({
			...topic,
			isAdditional:
				context.length > 0 &&
				normalizeWloText(topic.title) !== term &&
				!(topic.subjects ?? []).some((name) =>
					context.includes(normalizeWloText(name)),
				),
		}))
		.sort(
			(a, b) =>
				Number(a.isAdditional) - Number(b.isAdditional) ||
				rank(a.title) - rank(b.title) ||
				a.title.localeCompare(b.title, "de"),
		);
}
