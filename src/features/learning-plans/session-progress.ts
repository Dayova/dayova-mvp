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
