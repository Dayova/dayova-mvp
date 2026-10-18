import { resolveWloSubjectContext } from "#convex/wloSubjectContext";
import { examHintCatalog } from "./exam-hint-catalog";

const normalize = (text: string) =>
	text
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLocaleLowerCase("de-DE")
		.replace(/ß/g, "ss")
		.replace(/ae/g, "a")
		.replace(/oe/g, "o")
		.replace(/ue/g, "u");
const words = (text: string) =>
	normalize(text)
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
const searchAliases: Record<string, string> = {
	rechner: "taschenrechner",
	ohimi: "ohne hilfsmittel",
	formelblatt: "formelsammlung",
	zeilen: "zeilenangaben",
	woerterbuch: "worterbuch",
};

/** Topic matches lead; subject-wide options are a fallback. Explicit search
 * covers the whole catalog, including other subjects, before any UI limit.
 * Unknown subjects receive no guessed mapping; explicit topic matches still work.
 */
export function getExamHintExamples(
	subject: string,
	topics: readonly string[],
	query = "",
) {
	const context = resolveWloSubjectContext(subject);
	const topicWords = words(topics.join(" "));
	const terms = words(query).flatMap((term) =>
		words(searchAliases[term] ?? term),
	);
	const ranked = new Map<string, number>();
	for (const group of examHintCatalog) {
		const subjectMatch = group.subjects.some((name) => context.includes(name));
		const topicMatches = group.topics.filter((prefix) =>
			topicWords.some((word) => word.startsWith(normalize(prefix))),
		).length;
		const relevant = (subjectMatch || context.length === 0) && topicMatches > 0;
		const fallback = subjectMatch && group.topics.length === 0;
		if (!terms.length && !relevant && !fallback) continue;
		for (const hint of group.hints) {
			const searchable = normalize(hint);
			if (!terms.every((term) => searchable.includes(term))) continue;
			const score =
				(relevant ? 100 + topicMatches : 0) + (subjectMatch ? 10 : 0);
			ranked.set(hint, Math.max(score, ranked.get(hint) ?? -1));
		}
	}
	return [...ranked].sort((a, b) => b[1] - a[1]).map(([hint]) => hint);
}

const key = (value: string) =>
	value
		.normalize("NFKC")
		.trim()
		.toLocaleLowerCase("de-DE")
		.replace(/\s+/g, " ");

/** Only explicit additions; preserve all existing text, including scoped conditions. */
export function appendExamHint(current: string, addition: string) {
	const hint = addition.trim();
	if (!hint || current.split("\n").some((line) => key(line) === key(hint)))
		return current;
	return `${current}${current && !current.endsWith("\n") ? "\n" : ""}${hint}`;
}
