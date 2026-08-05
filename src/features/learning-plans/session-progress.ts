import type { SessionPhase } from "./types";

export const CONTINUE_LEARNING_MINUTES = 10;
// Keep the persisted suffix stable for sessions created by earlier app versions.
export const PAIRED_THEORY_QUESTION_SUFFIX = ":paired-practice";

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
		const pairedQuestionByTheoryCoverageKey = new Map(
			items.flatMap((item) => {
				const coverageKey = item.coverageKey;
				if (!isPairedTheoryQuestionItem(item) || !coverageKey) return [];
				return [
					[
						coverageKey.slice(0, -PAIRED_THEORY_QUESTION_SUFFIX.length),
						item,
					] as const,
				];
			}),
		);
		return items.flatMap((item) => {
			if (item.kind !== "learnCard") return [];
			const questionItem = item.coverageKey
				? pairedQuestionByTheoryCoverageKey.get(item.coverageKey)
				: undefined;
			return questionItem ? [questionItem, item] : [item];
		});
	}

	return [...items];
}

export function isPairedTheoryQuestionItem<
	Item extends { kind: string; phase?: SessionPhase; coverageKey?: string },
>(item: Item | null | undefined) {
	return Boolean(
		item &&
			item.kind !== "learnCard" &&
			item.phase === "practice" &&
			item.coverageKey?.endsWith(PAIRED_THEORY_QUESTION_SUFFIX),
	);
}

export function getPairedTheoryItem<
	Item extends { kind: string; phase?: SessionPhase; coverageKey?: string },
>(items: readonly Item[], currentIndex: number): Item | null {
	const questionItem = items[currentIndex];
	if (!isPairedTheoryQuestionItem(questionItem) || !questionItem?.coverageKey) {
		return null;
	}
	const theoryCoverageKey = questionItem.coverageKey.slice(
		0,
		-PAIRED_THEORY_QUESTION_SUFFIX.length,
	);
	return (
		items.find(
			(item) =>
				item.kind === "learnCard" && item.coverageKey === theoryCoverageKey,
		) ?? null
	);
}

export function getTheoryTopicPosition<
	Item extends { kind: string; phase?: SessionPhase; coverageKey?: string },
>(items: readonly Item[], currentIndex: number) {
	const theoryIndices = items.flatMap((item, index) =>
		item.kind === "learnCard" ? [index] : [],
	);
	const pairedTheoryItem = getPairedTheoryItem(items, currentIndex);
	const activeTheoryIndex = pairedTheoryItem
		? items.indexOf(pairedTheoryItem)
		: currentIndex;
	const topicIndex = theoryIndices.indexOf(activeTheoryIndex);

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
	_compositionVariant: "control" | "split",
): SessionPhase {
	return phase;
}

export function isQualifiedSessionCompletion(
	durationMinutes: number,
	activeStudySeconds: number,
) {
	return activeStudySeconds >= Math.ceil(durationMinutes * 60 * 0.8);
}
