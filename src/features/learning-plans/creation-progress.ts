export const LEARNING_PLAN_CREATION_STEPS = {
	examType: 1,
	examSubject: 1.5,
	examDate: 2,
	learningAvailability: 2.5,
	examTopics: 3,
	materialUpload: 3.5,
	materialAnalysis: 4,
	scopeConfirmation: 4.5,
	planGeneration: 5,
} as const;

export const LEARNING_PLAN_CREATION_TOTAL_STEPS =
	LEARNING_PLAN_CREATION_STEPS.planGeneration;

export const getSafeLearningPlanCreationProgress = ({
	currentStep,
	totalSteps = LEARNING_PLAN_CREATION_TOTAL_STEPS,
}: {
	currentStep: number;
	totalSteps?: number;
}) => {
	const safeTotalSteps =
		Number.isFinite(totalSteps) && totalSteps > 0
			? totalSteps
			: LEARNING_PLAN_CREATION_TOTAL_STEPS;
	const safeCurrentStep = Math.min(
		Math.max(Number.isFinite(currentStep) ? currentStep : 1, 1),
		safeTotalSteps,
	);

	return { currentStep: safeCurrentStep, totalSteps: safeTotalSteps };
};

export const getExamEntryCreationProgress = (
	step:
		| "basics"
		| "planning"
		| "learningAvailability"
		| "examType"
		| "examDetails",
) => {
	switch (step) {
		case "learningAvailability":
			return LEARNING_PLAN_CREATION_STEPS.learningAvailability;
		case "examType":
			return LEARNING_PLAN_CREATION_STEPS.examType;
		case "examDetails":
			return LEARNING_PLAN_CREATION_STEPS.examSubject;
		default:
			return LEARNING_PLAN_CREATION_STEPS.examDate;
	}
};

export const getLearningPlanCreationProgressPercentage = (progress: number) => {
	const { currentStep: safeProgress } = getSafeLearningPlanCreationProgress({
		currentStep: progress,
	});
	return Math.round((safeProgress / LEARNING_PLAN_CREATION_TOTAL_STEPS) * 100);
};
