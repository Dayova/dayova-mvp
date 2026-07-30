import { throwUserFacingError } from "./errors";

const MIN_TOPIC_DESCRIPTION_CHARS = 12;
const MIN_MEANINGFUL_WORDS = 2;

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

export const assertMeaningfulTeacherGuidance = (value: string) => {
	if (!isMeaningfulTopicDescription(value)) {
		throwUserFacingError(
			"Beschreibe den Hinweis deiner Lehrkraft bitte konkreter.",
		);
	}
};
