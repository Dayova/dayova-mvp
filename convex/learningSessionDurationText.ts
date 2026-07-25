const MINUTE_REFERENCE_SUFFIX =
	"(?=\\s*(?:[-‑–—]\\s*)?(?:minütig|Minuten\\b|Min(?:\\.|\\b)))";

export const alignSessionDurationReferences = (args: {
	value: string;
	durationMinutes: number;
	sourceDurationMinutes?: number;
}) => {
	const referencedMinutes = args.sourceDurationMinutes ?? "\\d+";
	const durationPattern = new RegExp(
		`\\b${referencedMinutes}${MINUTE_REFERENCE_SUFFIX}`,
		"giu",
	);
	return args.value.replace(durationPattern, String(args.durationMinutes));
};
