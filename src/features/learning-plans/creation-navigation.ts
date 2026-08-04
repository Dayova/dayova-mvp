type LearningPlanCreationBackIntent =
	| { kind: "previousQuestion"; questionIndex: number }
	| { kind: "confirmPause" }
	| { kind: "ignore" };

export const getLearningPlanCreationBackIntent = ({
	questionIndex,
	isPauseConfirmationVisible,
}: {
	questionIndex: number;
	isPauseConfirmationVisible: boolean;
}): LearningPlanCreationBackIntent => {
	if (isPauseConfirmationVisible) return { kind: "ignore" };
	if (questionIndex <= 0) return { kind: "confirmPause" };

	return {
		kind: "previousQuestion",
		questionIndex: questionIndex - 1,
	};
};

export type { LearningPlanCreationBackIntent };
