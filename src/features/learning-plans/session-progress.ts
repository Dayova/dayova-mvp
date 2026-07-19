import type { SessionPhase } from "./types";

export const CONTINUE_LEARNING_MINUTES = 10;

export const shouldRepeatSessionContent = (remainingSeconds: number | null) =>
	remainingSeconds !== 0;

export const shouldKeepSplitTheoryActive = (
	compositionVariant: "control" | "split",
	isContinuation: boolean,
	remainingSeconds: number,
) =>
	compositionVariant === "split" &&
	!isContinuation &&
	remainingSeconds > 10 * 60;

export const shouldTransitionToSplitPractice = (
	compositionVariant: "control" | "split",
	isContinuation: boolean,
	currentSeconds: number,
	nextSeconds: number,
) =>
	compositionVariant === "split" &&
	!isContinuation &&
	currentSeconds > 10 * 60 &&
	nextSeconds <= 10 * 60;

export const getLearningSessionRepeatStartIndex = <
	Item extends { phase: SessionPhase },
>(
	items: readonly Item[],
	compositionVariant: "control" | "split",
	isContinuation: boolean,
) => {
	if (compositionVariant !== "split" || isContinuation) return 0;
	const practiceIndex = items.findIndex((item) => item.phase === "practice");
	return practiceIndex >= 0 ? practiceIndex : 0;
};

export function getLearningSessionItems<Item extends { kind: string }>(
	items: readonly Item[],
	phase: SessionPhase,
	compositionVariant: "control" | "split",
) {
	if (phase === "theory" && compositionVariant !== "split") {
		return items.filter((item) => item.kind === "learnCard");
	}

	return [...items];
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
