type LearningPlanSetupStep = "requiredTopics" | "examHints" | "materialUpload";

type LearningPlanCreationBackIntent =
	| { kind: "previousStep"; step: "requiredTopics" | "examHints" }
	| { kind: "confirmPause" }
	| { kind: "exit" }
	| { kind: "ignore" };

export const getLearningPlanCreationBackIntent = ({
	step,
	hasSavedDraft,
	isPauseConfirmationVisible,
}: {
	step: LearningPlanSetupStep;
	hasSavedDraft: boolean;
	isPauseConfirmationVisible: boolean;
}): LearningPlanCreationBackIntent => {
	if (isPauseConfirmationVisible) return { kind: "ignore" };
	if (step === "materialUpload") {
		return { kind: "previousStep", step: "examHints" };
	}
	if (step === "examHints")
		return { kind: "previousStep", step: "requiredTopics" };
	if (hasSavedDraft) return { kind: "confirmPause" };
	return { kind: "exit" };
};

export type { LearningPlanCreationBackIntent, LearningPlanSetupStep };
