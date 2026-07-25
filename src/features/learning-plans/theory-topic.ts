import type { SessionContentItem } from "./types";

export type TheoryTopic = {
	conceptTitle: string;
	question: string;
	explanation: string;
	keyPoints: string[];
	example?: string;
	memoryCue?: string;
	commonMistake?: string;
};

const isGenericLearningCardTitle = (title: string) =>
	/^Lernkarte\s+\d+$/i.test(title.trim());

export const adaptTheoryTopic = (
	item: SessionContentItem,
	index: number,
): TheoryTopic => {
	if (item.theoryContent) return item.theoryContent;

	return {
		conceptTitle: isGenericLearningCardTitle(item.title)
			? `Thema ${index + 1}`
			: item.title,
		question: item.front ?? item.prompt,
		explanation: item.back ?? item.explanation,
		keyPoints: [],
		example: undefined,
		memoryCue: item.idealAnswer || undefined,
		commonMistake: undefined,
	};
};

export const buildTheorySpeechText = (topic: TheoryTopic) =>
	[
		topic.conceptTitle,
		`Leitfrage: ${topic.question}`,
		`Erklärung: ${topic.explanation}`,
		topic.keyPoints.length > 0
			? `Wichtig: ${topic.keyPoints.join(" ")}`
			: undefined,
		topic.example ? `Beispiel: ${topic.example}` : undefined,
		topic.memoryCue ? `Merksatz: ${topic.memoryCue}` : undefined,
		topic.commonMistake
			? `Typischer Fehler: ${topic.commonMistake}`
			: undefined,
	]
		.filter((section): section is string => Boolean(section))
		.map((section) => (/[.!?]$/.test(section) ? section : `${section}.`))
		.join(" ");

export const splitTheorySpeechText = (text: string, maximumLength: number) => {
	const remainingText = text.trim();
	const safeMaximumLength = Math.max(1, Math.floor(maximumLength));
	if (remainingText.length <= safeMaximumLength) return [remainingText];

	const chunks: string[] = [];
	let remaining = remainingText;
	while (remaining.length > safeMaximumLength) {
		const candidate = remaining.slice(0, safeMaximumLength + 1);
		const lastWhitespace = candidate.lastIndexOf(" ");
		const splitIndex = lastWhitespace > 0 ? lastWhitespace : safeMaximumLength;
		chunks.push(remaining.slice(0, splitIndex).trimEnd());
		remaining = remaining.slice(splitIndex).trimStart();
	}

	if (remaining) chunks.push(remaining);
	return chunks;
};

export const getTheoryTopicNavigation = (
	currentIndex: number,
	total: number,
) => {
	const lastIndex = Math.max(total - 1, 0);
	const safeIndex = Math.min(Math.max(currentIndex, 0), lastIndex);
	const isLastTopic = safeIndex === lastIndex;

	return {
		canGoPrevious: safeIndex > 0,
		isLastTopic,
		primaryLabel: isLastTopic ? "Theorie abschließen" : "Weiter",
	} as const;
};

export const runTheoryTopicPrimaryAction = ({
	currentIndex,
	total,
	onAdvance,
	onComplete,
}: {
	currentIndex: number;
	total: number;
	onAdvance: (nextIndex: number) => void;
	onComplete: () => void;
}) => {
	if (getTheoryTopicNavigation(currentIndex, total).isLastTopic) {
		onComplete();
		return "complete" as const;
	}

	onAdvance(currentIndex + 1);
	return "advance" as const;
};
