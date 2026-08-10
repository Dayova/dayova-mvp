export type LearningPlanSetupStep = "teacherGuidance" | "materialUpload";

export const getInitialLearningPlanSetupStep = ({
	hasError,
	routeStep,
}: {
	hasError: boolean;
	routeStep?: string;
}): LearningPlanSetupStep =>
	hasError || routeStep === "material" ? "materialUpload" : "teacherGuidance";

export const getNextLearningPlanSetupStep = (
	step: LearningPlanSetupStep,
): LearningPlanSetupStep | null =>
	step === "teacherGuidance" ? "materialUpload" : null;

export const getPreviousLearningPlanSetupStep = (
	step: LearningPlanSetupStep,
): LearningPlanSetupStep | null =>
	step === "materialUpload" ? "teacherGuidance" : null;
