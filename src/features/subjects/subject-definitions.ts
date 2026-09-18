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
