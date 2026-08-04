const DEFAULT_DIAGNOSTIC_QUESTION_COUNT = 5;

export const LEARNING_PLAN_CREATION_STEPS = {
	examDate: 1,
	examType: 2,
	examSubject: 3,
	materialUpload: 4,
	topicDescription: 5,
	workload: 11,
} as const;

export const LEARNING_PLAN_CREATION_TOTAL_STEPS =
	LEARNING_PLAN_CREATION_STEPS.topicDescription +
	DEFAULT_DIAGNOSTIC_QUESTION_COUNT +
	1;

const getDiagnosticQuestionCount = (questionCount?: number) => {
	const parsedCount = Math.trunc(
		questionCount ?? DEFAULT_DIAGNOSTIC_QUESTION_COUNT,
	);

	return Number.isFinite(parsedCount) && parsedCount > 0
		? parsedCount
		: DEFAULT_DIAGNOSTIC_QUESTION_COUNT;
};

export const getLearningPlanCreationTotalSteps = (questionCount?: number) =>
	LEARNING_PLAN_CREATION_STEPS.topicDescription +
	getDiagnosticQuestionCount(questionCount) +
	1;

export const getLearningPlanCreationWorkloadStep = (questionCount?: number) =>
	getLearningPlanCreationTotalSteps(questionCount);

export const getDiagnosticQuestionCreationStep = (
	questionIndex: number,
	questionCount?: number,
) => {
	const diagnosticQuestionCount = getDiagnosticQuestionCount(questionCount);
	const safeIndex = Math.min(
		Math.max(Math.trunc(questionIndex), 0),
		diagnosticQuestionCount - 1,
	);

	return LEARNING_PLAN_CREATION_STEPS.topicDescription + safeIndex + 1;
};
