import {
	BookOpen,
	Calculator,
	Chemistry,
	Code,
	Dna,
	Earth,
	Football,
	Language,
	Maps,
	Mic,
	MusicNote,
	PaintBrush,
	Pencil,
	TimeManagement,
} from "~/components/ui/icon";
import {
	BUILT_IN_SUBJECT_NAMES,
	normalizeSubjectName,
} from "~/features/subjects/subject-definitions";

const subjectIconByBuiltInName = {
	Mathematik: Calculator,
	Deutsch: Pencil,
	Englisch: Language,
	Biologie: Dna,
	Chemie: Chemistry,
	Physik: Earth,
	Geschichte: TimeManagement,
	Erdkunde: Maps,
	Sozialkunde: Mic,
	Informatik: Code,
	Kunst: PaintBrush,
	Musik: MusicNote,
	Sport: Football,
} satisfies Record<(typeof BUILT_IN_SUBJECT_NAMES)[number], typeof BookOpen>;

const BUILT_IN_SUBJECT_OPTIONS = BUILT_IN_SUBJECT_NAMES.map((name) => ({
	key: `built-in:${normalizeSubjectName(name)}`,
	name,
	kind: "builtIn" as const,
	Icon: subjectIconByBuiltInName[name],
}));

export {
	BookOpen as PersonalSubjectIcon,
	BUILT_IN_SUBJECT_OPTIONS,
	subjectIconByBuiltInName,
};
