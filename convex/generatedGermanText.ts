const GERMAN_UI_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
	[/\bAbschlusspruef/g, "Abschlussprüf"],
	[/\babschlusspruef/g, "abschlussprüf"],
	[/\bEinschaetz/g, "Einschätz"],
	[/\beinschaetz/g, "einschätz"],
	[/\bErloes/g, "Erlös"],
	[/\berloes/g, "erlös"],
	[/\bFaeh/g, "Fäh"],
	[/\bfaeh/g, "fäh"],
	[/\bDurchfuehrung\b/g, "Durchführung"],
	[/\bdurchfuehrung\b/g, "durchführung"],
	[/\bDurchfuehrungen\b/g, "Durchführungen"],
	[/\bdurchfuehrungen\b/g, "durchführungen"],
	[/\bLoesung\b/g, "Lösung"],
	[/\bloesung\b/g, "lösung"],
	[/\bLoesungen\b/g, "Lösungen"],
	[/\bloesungen\b/g, "lösungen"],
	[/\bLoesungsmenge\b/g, "Lösungsmenge"],
	[/\bloesungsmenge\b/g, "lösungsmenge"],
	[/\bLoesungsmengen\b/g, "Lösungsmengen"],
	[/\bloesungsmengen\b/g, "lösungsmengen"],
	[/\bLoesen\b/g, "Lösen"],
	[/\bloesen\b/g, "lösen"],
	[/\bMuendliche\b/g, "Mündliche"],
	[/\bmuendliche\b/g, "mündliche"],
	[/\bLoes/g, "Lös"],
	[/\bloes/g, "lös"],
	[/\bPlausibilitaet/g, "Plausibilität"],
	[/\bplausibilitaet/g, "plausibilität"],
	[/\bPruef/g, "Prüf"],
	[/\bpruef/g, "prüf"],
	[/\bUeber/g, "Über"],
	[/\bueber/g, "über"],
	[/\bVerstaend/g, "Verständ"],
	[/\bverstaend/g, "verständ"],
	[/\bVollstaend/g, "Vollständ"],
	[/\bvollstaend/g, "vollständ"],
	[/\bFuer\b/g, "Für"],
	[/\bfuer\b/g, "für"],
	[/\bGeraet\b/g, "Gerät"],
	[/\bgeraet\b/g, "gerät"],
	[/\bGeraete\b/g, "Geräte"],
	[/\bgeraete\b/g, "geräte"],
	[/\bgroessere\b/g, "größere"],
	[/\bGroessere\b/g, "Größere"],
	[/\bgroesseren\b/g, "größeren"],
	[/\bGroesseren\b/g, "Größeren"],
	[/\bgroesste\b/g, "größte"],
	[/\bGroesste\b/g, "Größte"],
	[/\bgroessten\b/g, "größten"],
	[/\bGroessten\b/g, "Größten"],
	[/\bgrosse\b/g, "große"],
	[/\bGrosse\b/g, "Große"],
	[/\bgrossen\b/g, "großen"],
	[/\bGrossen\b/g, "Großen"],
	[/\bgrosser\b/g, "großer"],
	[/\bGrosser\b/g, "Großer"],
	[/\bgrosses\b/g, "großes"],
	[/\bGrosses\b/g, "Großes"],
	[/\bSchueler\b/g, "Schüler"],
	[/\bschueler\b/g, "schüler"],
	[/\bStrasse\b/g, "Straße"],
	[/\bstrasse\b/g, "straße"],
	[/\bStrassen\b/g, "Straßen"],
	[/\bstrassen\b/g, "straßen"],
	[/\bUebung\b/g, "Übung"],
	[/\buebung\b/g, "übung"],
	[/\bUebungen\b/g, "Übungen"],
	[/\buebungen\b/g, "übungen"],
	[/\bUeben\b/g, "Üben"],
	[/\bueben\b/g, "üben"],
];

const unsafeControlCharacterPattern = new RegExp(
	["[\\u0000-\\u0008", "\\u000B\\u000C", "\\u000E-\\u001F", "\\u007F]"].join(
		"",
	),
);

export class InvalidGeneratedGermanTextError extends Error {
	constructor() {
		super("Die KI hat ungültige Sonderzeichen erzeugt. Versuche es erneut.");
		this.name = "InvalidGeneratedGermanTextError";
	}
}

export const isInvalidGeneratedGermanTextError = (
	error: unknown,
): error is InvalidGeneratedGermanTextError =>
	error instanceof InvalidGeneratedGermanTextError;

export const normalizeGeneratedGermanText = (value: string) => {
	const formatted = GERMAN_UI_REPLACEMENTS.reduce(
		(formatted, [pattern, replacement]) =>
			formatted.replace(pattern, replacement),
		value,
	);

	if (unsafeControlCharacterPattern.test(formatted)) {
		throw new InvalidGeneratedGermanTextError();
	}

	return formatted.normalize("NFC");
};
