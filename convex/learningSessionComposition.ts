export type LearningSessionCompositionVariant = "control" | "split";
export type LearningSessionSegmentPhase = "theory" | "practice" | "rehearsal";

export type LearningSessionSegment = {
	phase: LearningSessionSegmentPhase;
	durationMinutes: number;
};

export const SPLIT_SESSION_TOTAL_MINUTES = 30;
export const SPLIT_SESSION_THEORY_MINUTES = 20;
export const SPLIT_SESSION_PRACTICE_MINUTES = 10;

export const isLearningSessionCompositionEligible = ({
	phase,
	durationMinutes,
}: {
	phase: LearningSessionSegmentPhase;
	durationMinutes: number;
}) => phase === "theory" && durationMinutes === SPLIT_SESSION_TOTAL_MINUTES;

export const getLearningSessionComposition = ({
	phase,
	durationMinutes,
	variant,
}: {
	phase: LearningSessionSegmentPhase;
	durationMinutes: number;
	variant: LearningSessionCompositionVariant;
}): LearningSessionSegment[] => {
	if (
		variant === "split" &&
		isLearningSessionCompositionEligible({ phase, durationMinutes })
	) {
		return [
			{ phase: "theory", durationMinutes: SPLIT_SESSION_THEORY_MINUTES },
			{ phase: "practice", durationMinutes: SPLIT_SESSION_PRACTICE_MINUTES },
		];
	}

	return [{ phase, durationMinutes }];
};
