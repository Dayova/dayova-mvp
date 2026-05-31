import { InvalidGeneratedGermanTextError } from "./generatedGermanText";

const CONTROL_MARKER = "\u0004";
const ASCII_SHADOW_REPLACEMENTS: ReadonlyArray<
	readonly [unicode: string, asciiAlternatives: readonly string[]]
> = [
	["Ä", ["Ae", "AE"]],
	["Ö", ["Oe", "OE"]],
	["Ü", ["Ue", "UE"]],
	["ẞ", ["SS"]],
	["ä", ["ae"]],
	["ö", ["oe"]],
	["ü", ["ue"]],
	["ß", ["ss"]],
];

const markerReplacementByAscii = ASCII_SHADOW_REPLACEMENTS.flatMap(
	([unicode, asciiAlternatives]) =>
		asciiAlternatives.map((ascii) => ({ ascii, unicode })),
).sort((left, right) => right.ascii.length - left.ascii.length);

const asciiAlternativesByUnicode = new Map(
	ASCII_SHADOW_REPLACEMENTS.map(([unicode, asciiAlternatives]) => [
		unicode,
		asciiAlternatives,
	]),
);

const consumeAscii = (
	asciiShadow: string,
	asciiIndex: number,
	expected: string,
) =>
	asciiShadow.startsWith(expected, asciiIndex)
		? asciiIndex + expected.length
		: null;

const consumeAnyAsciiAlternative = (
	asciiShadow: string,
	asciiIndex: number,
	alternatives: readonly string[],
) => {
	for (const alternative of alternatives) {
		const nextIndex = consumeAscii(asciiShadow, asciiIndex, alternative);
		if (nextIndex !== null) return nextIndex;
	}

	return null;
};

const consumeRegularCharacter = (
	char: string,
	asciiShadow: string,
	asciiIndex: number,
) => {
	const asciiAlternatives = asciiAlternativesByUnicode.get(char);
	if (asciiAlternatives) {
		return (
			consumeAnyAsciiAlternative(asciiShadow, asciiIndex, asciiAlternatives) ??
			consumeAscii(asciiShadow, asciiIndex, char)
		);
	}

	return consumeAscii(asciiShadow, asciiIndex, char);
};

const recoverMarkerFromAsciiShadow = (
	asciiShadow: string,
	asciiIndex: number,
) => {
	for (const replacement of markerReplacementByAscii) {
		const nextIndex = consumeAscii(asciiShadow, asciiIndex, replacement.ascii);
		if (nextIndex !== null) {
			return {
				char: replacement.unicode,
				nextIndex,
			};
		}
	}

	throw new InvalidGeneratedGermanTextError();
};

export const repairGeneratedGermanTextFromAsciiShadow = (
	value: string,
	asciiShadow: string,
) => {
	if (!value.includes(CONTROL_MARKER)) return value;
	if (asciiShadow.includes(CONTROL_MARKER)) {
		throw new InvalidGeneratedGermanTextError();
	}

	let repaired = "";
	let asciiIndex = 0;
	for (const char of Array.from(value)) {
		if (char === CONTROL_MARKER) {
			const recovered = recoverMarkerFromAsciiShadow(asciiShadow, asciiIndex);
			repaired += recovered.char;
			asciiIndex = recovered.nextIndex;
			continue;
		}

		const nextAsciiIndex = consumeRegularCharacter(
			char,
			asciiShadow,
			asciiIndex,
		);
		if (nextAsciiIndex === null) {
			throw new InvalidGeneratedGermanTextError();
		}
		repaired += char;
		asciiIndex = nextAsciiIndex;
	}

	if (asciiIndex !== asciiShadow.length) {
		throw new InvalidGeneratedGermanTextError();
	}

	return repaired;
};
