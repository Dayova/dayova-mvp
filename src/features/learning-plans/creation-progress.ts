const DIAGNOSTIC_QUESTION_COUNT = 5;

export const LEARNING_PLAN_CREATION_STEPS = {
	examDate: 1,
	examType: 2,
	examSubject: 3,
	materialUpload: 4,
	examEvidence: 5,
	scopeConfirmation: 6,
	workload: 12,
} as const;

export const LEARNING_PLAN_CREATION_TOTAL_STEPS =
	LEARNING_PLAN_CREATION_STEPS.scopeConfirmation +
	DIAGNOSTIC_QUESTION_COUNT +
	1;

export const getDiagnosticQuestionCreationStep = (questionIndex: number) => {
	const safeIndex = Math.min(
		Math.max(Math.trunc(questionIndex), 0),
		DIAGNOSTIC_QUESTION_COUNT - 1,
	);

	return LEARNING_PLAN_CREATION_STEPS.scopeConfirmation + safeIndex + 1;
};
