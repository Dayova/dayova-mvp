import {
	BookOpen,
	Bulb,
	Calculator,
	Chemistry,
	Code,
	CreditCard,
	Dna,
	Earth,
	Football,
	Language,
	Maps,
	Mic,
	MusicNote,
	PaintBrush,
	Pencil,
	Plant,
	Sparkles,
	Telescope,
	TimeManagement,
} from "~/components/ui/icon";

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

// Resolve locally from the name so existing and renamed subjects stay consistent.
const personalSubjectIconRules: readonly [
	readonly string[],
	typeof BookOpen,
][] = [
	[["astrologie", "sternzeichen", "horoskope"], Sparkles],
	[["astronomie", "astrophysik", "weltraum"], Telescope],
	[
		[
			"französisch",
			"spanisch",
			"italienisch",
			"latein",
			"portugiesisch",
			"russisch",
			"türkisch",
			"griechisch",
			"chinesisch",
			"japanisch",
			"arabisch",
			"sprachen",
		],
		Language,
	],
	[["philosophie", "ethik", "psychologie"], Bulb],
	[["wirtschaft", "bwl", "vwl", "finanzen", "buchhaltung"], CreditCard],
	[["politik", "gesellschaftskunde", "gemeinschaftskunde"], Mic],
	[["ökologie", "umwelt", "botanik", "gartenbau"], Plant],
	[["programmieren", "programmierung", "robotik"], Code],
	[["geografie", "geographie"], Maps],
];

function getSubjectIcon(name: string): typeof BookOpen {
	const normalized = normalizeSubjectName(name);
	const words = normalized.split(/[^\p{L}\p{N}]+/u);
	const builtIn = BUILT_IN_SUBJECT_NAMES.find((subject) =>
		words.includes(normalizeSubjectName(subject)),
	);
	if (builtIn) return subjectIconByBuiltInName[builtIn];
	for (const [aliases, Icon] of personalSubjectIconRules) {
		if (aliases.some((alias) => words.includes(alias))) return Icon;
	}
	return BookOpen;
}

export { getSubjectIcon };
