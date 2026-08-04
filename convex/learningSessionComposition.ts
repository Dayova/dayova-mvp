export type LearningSessionCompositionVariant = "control" | "split";
export type LearningSessionSegmentPhase = "theory" | "practice" | "rehearsal";

export type LearningSessionSegment = {
	phase: LearningSessionSegmentPhase;
	durationMinutes: number;
};

export const THEORY_VALIDATION_MINUTES = 3;
export const MINIMUM_THEORY_SESSION_MINUTES = 6;

export const isLearningSessionCompositionEligible = ({
	phase,
	durationMinutes,
}: {
	phase: LearningSessionSegmentPhase;
	durationMinutes: number;
}) => phase === "theory" && durationMinutes >= MINIMUM_THEORY_SESSION_MINUTES;

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
			{ phase: "practice", durationMinutes: THEORY_VALIDATION_MINUTES },
			{
				phase: "theory",
				durationMinutes: durationMinutes - THEORY_VALIDATION_MINUTES,
			},
		];
	}

	return [{ phase, durationMinutes }];
};
