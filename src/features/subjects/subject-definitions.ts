const BUILT_IN_SUBJECT_NAMES = [
	"Mathematik",
	"Deutsch",
	"Englisch",
	"Biologie",
	"Chemie",
	"Physik",
	"Geschichte",
	"Erdkunde",
	"Sozialkunde",
	"Informatik",
	"Kunst",
	"Musik",
	"Sport",
] as const;

const normalizeSubjectName = (value: string) =>
	value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

const cleanSubjectName = (value: string) => value.trim().replace(/\s+/g, " ");

export { BUILT_IN_SUBJECT_NAMES, cleanSubjectName, normalizeSubjectName };

// This dictionary improves entered names; it does not add default picker options.
const KNOWN_SUBJECT_NAMES = [
	...BUILT_IN_SUBJECT_NAMES,
	"Französisch",
	"Latein",
	"Spanisch",
	"Italienisch",
	"Portugiesisch",
	"Russisch",
	"Türkisch",
	"Griechisch",
	"Chinesisch",
	"Japanisch",
	"Religion",
	"Ethik",
	"Philosophie",
	"Wirtschaft",
	"Politik",
] as const;

const spellingKey = (value: string) =>
	normalizeSubjectName(value)
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

function isSingleSpellingEdit(left: string, right: string): boolean {
	if (Math.abs(left.length - right.length) > 1) return false;
	let index = 0;
	while (
		index < Math.min(left.length, right.length) &&
		left[index] === right[index]
	)
		index++;
	if (left.length !== right.length) {
		return left.length > right.length
			? left.slice(index + 1) === right.slice(index)
			: left.slice(index) === right.slice(index + 1);
	}
	return (
		left.slice(index + 1) === right.slice(index + 1) ||
		(left[index] === right[index + 1] &&
			left[index + 1] === right[index] &&
			left.slice(index + 2) === right.slice(index + 2))
	);
}

function correctSubjectName(value: string): string {
	const cleaned = cleanSubjectName(value);
	if (!cleaned) return "";
	const key = spellingKey(cleaned);
	const exact = KNOWN_SUBJECT_NAMES.find((name) => spellingKey(name) === key);
	if (exact) return exact;
	// Only correct a single, unambiguous typo in longer known names. Keep
	// abbreviations, course suffixes and individual multi-word names intact.
	if (key.length >= 6 && !key.includes(" ")) {
		const candidates = KNOWN_SUBJECT_NAMES.filter((name) =>
			isSingleSpellingEdit(key, spellingKey(name)),
		);
		if (candidates.length === 1) return candidates[0];
	}
	return cleaned.charAt(0).toLocaleUpperCase("de-DE") + cleaned.slice(1);
}

export { correctSubjectName };
