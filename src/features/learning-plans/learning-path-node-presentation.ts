import type { SessionPhase } from "~/features/learning-plans/types";

export type LearningPathNodeState = "completed" | "current" | "locked";
export type LearningPathNodeIcon = "check" | "dumbbell" | "note" | "repeat";
export type LearningPathNodeHalo = "none" | "segmented" | "solid";
export type LearningPathNodeMotion = "breathe" | "still";
export type LearningPathNodeTone = "blue" | "gray";

export type LearningPathNodePresentation = {
	halo: LearningPathNodeHalo;
	icon: LearningPathNodeIcon;
	motion: LearningPathNodeMotion;
	tone: LearningPathNodeTone;
};

export const LEARNING_PATH_BREATHING = {
	halfCycleMs: 1000,
	maxScale: 1.06,
	minScale: 0.96,
} as const;

export const LEARNING_PATH_PHASE_ICON: Record<
	SessionPhase,
	LearningPathNodeIcon
> = {
	theory: "note",
	practice: "dumbbell",
	rehearsal: "repeat",
};

export const getLearningPathNodePresentation = ({
	phase,
	selected,
	state,
}: {
	phase: SessionPhase;
	selected: boolean;
	state: LearningPathNodeState;
}): LearningPathNodePresentation => {
	if (state === "completed") {
		return {
			halo: selected ? "solid" : "none",
			icon: "check",
			motion: "still",
			tone: "blue",
		};
	}
	if (state === "current") {
		return {
			halo: "segmented",
			icon: LEARNING_PATH_PHASE_ICON[phase],
			motion: "breathe",
			tone: "blue",
		};
	}

	return {
		halo: "none",
		icon: LEARNING_PATH_PHASE_ICON[phase],
		motion: "still",
		tone: "gray",
	};
};
