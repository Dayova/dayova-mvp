import type { SessionPhase } from "./types";

export const CONTINUE_LEARNING_MINUTES = 10;
export const PAIRED_THEORY_PRACTICE_SUFFIX = ":paired-practice";

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
		const pairedPracticeByTheoryCoverageKey = new Map(
			items.flatMap((item) => {
				const coverageKey = item.coverageKey;
				if (!isPairedTheoryPracticeItem(item) || !coverageKey) return [];
				return [
					[
						coverageKey.slice(0, -PAIRED_THEORY_PRACTICE_SUFFIX.length),
						item,
					] as const,
				];
			}),
		);
		const pairedPracticeItems = new Set(
			pairedPracticeByTheoryCoverageKey.values(),
		);
		const pairedItems = items.flatMap((item) => {
			if (item.kind !== "learnCard") return [];
			const practiceItem = item.coverageKey
				? pairedPracticeByTheoryCoverageKey.get(item.coverageKey)
				: undefined;
			return practiceItem ? [item, practiceItem] : [item];
		});

		return [
			...validationItems,
			...pairedItems,
			...items.filter(
				(item) =>
					!validationItemSet.has(item) &&
					item.kind !== "learnCard" &&
					!pairedPracticeItems.has(item),
			),
		];
	}

	return [...items];
}

export function isPairedTheoryPracticeItem<
	Item extends { kind: string; phase?: SessionPhase; coverageKey?: string },
>(item: Item | null | undefined) {
	return Boolean(
		item &&
			item.kind !== "learnCard" &&
			item.phase === "practice" &&
			item.coverageKey?.endsWith(PAIRED_THEORY_PRACTICE_SUFFIX),
	);
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
