export const LEARNING_PLAN_CREATION_STEPS = {
	examDate: 1,
	examType: 1,
	examSubject: 1,
	materialUpload: 2,
	examEvidence: 2,
	scopeConfirmation: 3,
	diagnostic: 4,
	planGeneration: 5,
} as const;

export const LEARNING_PLAN_CREATION_TOTAL_STEPS =
	LEARNING_PLAN_CREATION_STEPS.planGeneration;

export const getDiagnosticQuestionCreationStep = (_questionIndex: number) =>
	LEARNING_PLAN_CREATION_STEPS.diagnostic;
