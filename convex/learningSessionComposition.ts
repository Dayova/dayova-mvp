export type LearningSessionCompositionVariant = "control" | "split";
export type LearningSessionSegmentPhase = "theory" | "practice" | "rehearsal";

export type LearningSessionSegment = {
	phase: LearningSessionSegmentPhase;
	durationMinutes: number;
};

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
	void variant;
	return [{ phase, durationMinutes }];
};
