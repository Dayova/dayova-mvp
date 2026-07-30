const DIAGNOSTIC_QUESTION_COUNT = 5;
const DIAGNOSTIC_PROGRESS_END = 4.75;

export const LEARNING_PLAN_CREATION_STEPS = {
	examDate: 1,
	learningAvailability: 1.25,
	examType: 1.5,
	examSubject: 1.75,
	materialUpload: 2,
	examEvidence: 2.5,
	materialAnalysis: 2.75,
	scopeConfirmation: 3,
	diagnostic: 3.25,
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

export const getDiagnosticQuestionCreationStep = (questionIndex: number) => {
	const safeIndex = Math.min(
		Math.max(Math.trunc(questionIndex), 0),
		DIAGNOSTIC_QUESTION_COUNT - 1,
	);
	const progressPerQuestion =
		(DIAGNOSTIC_PROGRESS_END - LEARNING_PLAN_CREATION_STEPS.diagnostic) /
		(DIAGNOSTIC_QUESTION_COUNT - 1);
	return (
		LEARNING_PLAN_CREATION_STEPS.diagnostic + safeIndex * progressPerQuestion
	);
};

export const getLearningPlanCreationProgressPercentage = (progress: number) => {
	const safeProgress = Math.min(
		Math.max(progress, LEARNING_PLAN_CREATION_STEPS.examDate),
		LEARNING_PLAN_CREATION_TOTAL_STEPS,
	);
	return Math.round((safeProgress / LEARNING_PLAN_CREATION_TOTAL_STEPS) * 100);
};
