import { throwUserFacingError } from "./errors";

export type ExamTopicInput = {
	topicItems: string[];
	topicAdditionalInfo: string;
};

export const topicTitleKey = (title: string) =>
	title
		.normalize("NFKC")
		.trim()
		.replace(/\s+/g, " ")
		.toLocaleLowerCase("de-DE");

export function composeExamTopicDescription(input: ExamTopicInput) {
	return [...input.topicItems, input.topicAdditionalInfo]
		.filter(Boolean)
		.join("\n")
		.trim();
}

/** Legacy scope stays intact as free text; never guess catalog boundaries. */
export function readExamTopicInput(source: {
	topicDescription?: string;
	topicItems?: string[];
	topicAdditionalInfo?: string;
	teacherGuidance?: string;
}): ExamTopicInput {
	if (source.topicItems !== undefined) {
		return {
			topicItems: source.topicItems,
			topicAdditionalInfo: source.topicAdditionalInfo ?? "",
		};
	}
	return {
		topicItems: [],
		topicAdditionalInfo: [
			source.topicDescription ?? "",
			source.teacherGuidance !== source.topicDescription
				? source.teacherGuidance
				: "",
		]
			.filter(Boolean)
			.join("\n"),
	};
}

export function parseTopicItemsParam(value: string | undefined) {
	if (value === undefined) return undefined;
	try {
		const items: unknown = JSON.parse(value);
		if (
			!Array.isArray(items) ||
			!items.every((item): item is string => typeof item === "string")
		)
			return undefined;
		const keys = items.map(topicTitleKey);
		return keys.some((key) => !key) || new Set(keys).size !== keys.length
			? undefined
			: items;
	} catch {
		return undefined;
	}
}

/** Structured input and the compatibility projection must describe the same scope. */
export function validateExamTopicInput(source: {
	topicDescription: string;
	topicItems?: string[];
	topicAdditionalInfo?: string;
}): { topicDescription: string } & Partial<ExamTopicInput> {
	if (source.topicItems === undefined) {
		if (source.topicAdditionalInfo !== undefined)
			throwUserFacingError("Themenauswahl fehlt.");
		return { topicDescription: source.topicDescription.trim() };
	}
	const keys = source.topicItems.map(topicTitleKey);
	if (keys.some((key) => !key) || new Set(keys).size !== keys.length) {
		throwUserFacingError("Bitte prüfe die ausgewählten Themen.");
	}
	const input = {
		topicItems: source.topicItems.map((item) => item.trim()),
		topicAdditionalInfo: source.topicAdditionalInfo ?? "",
	};
	const topicDescription = composeExamTopicDescription(input);
	if (topicDescription !== source.topicDescription.trim()) {
		throwUserFacingError(
			"Themenauswahl und Prüfungsumfang stimmen nicht überein.",
		);
	}
	return { ...input, topicDescription };
}
