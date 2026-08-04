import type { SessionPhase } from "./types";

export const CONTINUE_LEARNING_MINUTES = 10;

export function getLearningSessionTimerDurationSeconds({
	phase,
	durationMinutes,
	hasCurrentItem,
	isContinuation,
}: {
	phase: SessionPhase | undefined;
	durationMinutes: number | undefined;
	hasCurrentItem: boolean;
	isContinuation: boolean;
}) {
	if (
		phase !== "rehearsal" ||
		isContinuation ||
		!hasCurrentItem ||
		!durationMinutes
	) {
		return null;
	}

	return durationMinutes * 60;
}

export function getLearningSessionItems<
	Item extends { kind: string; phase?: SessionPhase; coverageKey?: string },
>(
	items: readonly Item[],
	phase: SessionPhase,
	compositionVariant: "control" | "split",
) {
	if (phase === "theory" && compositionVariant !== "split") {
		return items.filter((item) => item.kind === "learnCard");
	}
	if (phase === "theory") {
		const validationItems = items.filter(
			(item) =>
				item.kind !== "learnCard" &&
				item.phase === "practice" &&
				item.coverageKey?.includes(":validation:"),
		);
		const validationItemSet = new Set(validationItems);
		return [
			...validationItems,
			...items.filter((item) => !validationItemSet.has(item)),
		];
	}

	return [...items];
}

export function isTheoryKnowledgeCheckItem<
	Item extends { kind: string; phase?: SessionPhase; coverageKey?: string },
>({
	item,
	phase,
	compositionVariant,
}: {
	item: Item | null | undefined;
	phase: SessionPhase | undefined;
	compositionVariant: "control" | "split" | undefined;
}) {
	return Boolean(
		item &&
			phase === "theory" &&
			compositionVariant === "split" &&
			item.kind !== "learnCard" &&
			item.phase === "practice" &&
			item.coverageKey?.includes(":validation:"),
	);
}

export function getTheoryTopicPosition<Item extends { kind: string }>(
	items: readonly Item[],
	currentIndex: number,
) {
	const theoryIndices = items.flatMap((item, index) =>
		item.kind === "learnCard" ? [index] : [],
	);
	const topicIndex = theoryIndices.indexOf(currentIndex);

	return {
		topicIndex,
		total: theoryIndices.length,
		previousSessionIndex:
			topicIndex > 0 ? (theoryIndices[topicIndex - 1] ?? null) : null,
		nextSessionIndex:
			topicIndex >= 0 && topicIndex < theoryIndices.length - 1
				? (theoryIndices[topicIndex + 1] ?? null)
				: null,
	};
}

export function getLearningSessionCompletionPhase(
	phase: SessionPhase,
	compositionVariant: "control" | "split",
): SessionPhase {
	return phase === "theory" && compositionVariant === "split"
		? "practice"
		: phase;
}

export function isQualifiedSessionCompletion(
	durationMinutes: number,
	activeStudySeconds: number,
) {
	return activeStudySeconds >= Math.ceil(durationMinutes * 60 * 0.8);
}
