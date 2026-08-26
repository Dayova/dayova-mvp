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

export type TheoryPagePresentation = {
	sectionTitle: string;
	showKeyPoints: boolean;
	showExample: boolean;
	showMemoryCue: boolean;
	showCommonMistake: boolean;
};

export const getTheoryPagePresentation = (
	questionAngle: string | undefined,
): TheoryPagePresentation => {
	switch (questionAngle) {
		case "recall":
			return {
				sectionTitle: "Kernidee",
				showKeyPoints: true,
				showExample: false,
				showMemoryCue: true,
				showCommonMistake: false,
			};
		case "recognize":
			return {
				sectionTitle: "Woran du es erkennst",
				showKeyPoints: true,
				showExample: true,
				showMemoryCue: false,
				showCommonMistake: false,
			};
		case "apply":
			return {
				sectionTitle: "So funktioniert es",
				showKeyPoints: false,
				showExample: true,
				showMemoryCue: true,
				showCommonMistake: false,
			};
		case "findError":
			return {
				sectionTitle: "Darauf musst du achten",
				showKeyPoints: false,
				showExample: false,
				showMemoryCue: true,
				showCommonMistake: true,
			};
		default:
			return {
				sectionTitle: "Das solltest du wissen",
				showKeyPoints: true,
				showExample: true,
				showMemoryCue: true,
				showCommonMistake: true,
			};
	}
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
