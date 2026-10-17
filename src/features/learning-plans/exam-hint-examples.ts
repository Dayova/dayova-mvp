import { resolveWloSubjectContext } from "#convex/wloSubjectContext";

/** Reviewed, deterministic examples v1. Suggestions, never inferred requirements. */
export function getExamHintExamples(
	subject: string,
	topics: readonly string[],
) {
	const context = resolveWloSubjectContext(subject);
	const examples: string[] = [];
	if (context.includes("Mathematik")) {
		examples.push("Ohne Taschenrechner", "Lösungsweg angeben");
		if (/geometrie|vektor|dreieck/i.test(topics.join(" "))) {
			examples.push("Skizzen beschriften");
		}
	}
	if (context.includes("Deutsch")) {
		examples.push(
			"Textbelege mit Zeilenangaben",
			"Nur die behandelten Kapitel",
		);
	}
	if (context.includes("Wirtschaftskunde")) {
		examples.push("Rechenweg angeben");
		if (
			/buchhaltung|buchung|bilanz|inventur/i.test(
				`${subject} ${topics.join(" ")}`,
			)
		) {
			examples.unshift("Buchungssätze mit Kontonummern angeben");
		}
	}
	if (context.includes("Physik") || context.includes("Chemie")) {
		examples.push("Einheiten angeben", "Rechenweg angeben");
	}
	if (context.includes("Biologie")) examples.push("Fachbegriffe verwenden");
	if (
		["Englisch", "Französisch", "Spanisch", "Latein"].some((name) =>
			context.includes(name),
		)
	) {
		examples.push("Nur das behandelte Vokabular");
	}
	return [...new Set(examples)].slice(0, 3);
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
