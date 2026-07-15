import type { LearningPathNodeState } from "~/components/learning-plans/learning-path-layout";
import type { SessionPhase } from "~/features/learning-plans/types";

export type LearningPathNodeIconKind =
	| "completed"
	| "theory"
	| "practice"
	| "repeat";

export function getLearningPathNodeIconKind(
	phase: SessionPhase,
	state: LearningPathNodeState,
): LearningPathNodeIconKind {
	if (state === "completed") return "completed";
	if (phase === "rehearsal") return "repeat";
	return phase;
}
