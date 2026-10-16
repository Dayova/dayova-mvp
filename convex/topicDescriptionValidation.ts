import { throwUserFacingError } from "./errors";

const MIN_TOPIC_DESCRIPTION_CHARS = 3;
const MIN_MEANINGFUL_WORDS = 1;

const placeholderWords = new Set([
	"asdf",
	"qwertz",
	"qwerty",
	"test",
	"bla",
	"blabla",
	"foo",
	"bar",
	"xxx",
	"todo",
	"keine",
	"nichts",
	"mathe",
	"mathematik",
	"mathematiktest",
	"arbeit",
	"prufung",
	"klausur",
	"schulaufgabe",
	"leistungskontrolle",
	"thema",
	"und",
	"oder",
	"mit",
	"ohne",
	"die",
	"der",
	"das",
	"den",
	"von",
	"fur",
]);

const normalizeTopicWord = (word: string) =>
	word
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "");

const isMeaningfulTopicWord = (word: string) => {
	const normalized = normalizeTopicWord(word);
	if (normalized.length < 3) return false;
	if (placeholderWords.has(normalized)) return false;
	if (/^(.)\1+$/.test(normalized)) return false;
	if (!/[a-zäöüß]/i.test(word)) return false;

	return true;
};

/** Accepts concrete topic names while rejecting short or placeholder-only input. */
export const isMeaningfulTopicDescription = (value: string) => {
	const trimmed = value.trim();
	if (trimmed.length < MIN_TOPIC_DESCRIPTION_CHARS) return false;

	const words = trimmed.match(/[\p{L}\p{N}]+/gu) ?? [];
	const meaningfulWords = words.filter(isMeaningfulTopicWord);
	const uniqueMeaningfulWords = new Set(
		meaningfulWords.map((word) => normalizeTopicWord(word)),
	);

	return uniqueMeaningfulWords.size >= MIN_MEANINGFUL_WORDS;
};

export const assertMeaningfulTopicDescription = (value: string) => {
	if (!isMeaningfulTopicDescription(value)) {
		throwUserFacingError("Beschreibe das Prüfungsthema bitte genauer.");
	}
};

/** Ensures explicit item boundaries describe exactly the saved text. */
export const assertTopicItemsMatchDescription = (
	description: string,
	items?: string[],
) => {
	if (
		items &&
		(items.some((item) => item.length === 0) ||
			items.join("\n") !== description)
	) {
		throwUserFacingError(
			"Die Themenauswahl passt nicht zur Beschreibung. Bitte versuche es erneut.",
		);
	}
};
