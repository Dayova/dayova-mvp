export const LEARNING_PLAN_CREATION_STEPS = {
	examType: 1,
	examSubject: 1.5,
	examDate: 2,
	learningAvailability: 2.5,
	materialUpload: 3,
	examEvidence: 3.5,
	materialAnalysis: 4,
	scopeConfirmation: 4.5,
	planGeneration: 5,
} as const;

export const LEARNING_PLAN_CREATION_TOTAL_STEPS =
	LEARNING_PLAN_CREATION_STEPS.planGeneration;

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
	const safeProgress = Math.min(
		Math.max(progress, LEARNING_PLAN_CREATION_STEPS.examType),
		LEARNING_PLAN_CREATION_TOTAL_STEPS,
	);
	return Math.round((safeProgress / LEARNING_PLAN_CREATION_TOTAL_STEPS) * 100);
};
