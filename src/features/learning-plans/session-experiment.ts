export const LEARNING_SESSION_COMPOSITION_FLAG = "learning-session-composition";

export type LearningSessionCompositionVariant = "control" | "split";

export const resolveLearningSessionCompositionVariant = (
	flagValue: unknown,
): LearningSessionCompositionVariant =>
	flagValue === "split" || flagValue === "test" ? "split" : "control";
