import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { MISSING_LEARNING_TIMES_HINT } from "../../../convex/learningPlanPlanningHints";

export const LEARNING_TIME_REPLAN_PARAM = "learning-times";

export const buildPlanGenerationAnswers = (snapshot: LearningPlanSnapshot) =>
	snapshot.plan.knowledgeQuestions.map((question) => ({
		questionId: question.id,
		answer:
			snapshot.answers
				.find((item) => item.questionId === question.id)
				?.answer.trim() ?? "",
	}));

export const shouldReplanAfterLearningTimes = (
	snapshot: LearningPlanSnapshot | null,
	replanReason?: string,
) => {
	if (!snapshot) return false;
	if (replanReason !== LEARNING_TIME_REPLAN_PARAM) return false;
	if (snapshot.plan.status !== "generated") return false;
	if (snapshot.sessions.length > 0) return false;
	if (snapshot.plan.planningHint?.includes(MISSING_LEARNING_TIMES_HINT)) {
		return false;
	}
	if (snapshot.plan.knowledgeQuestions.length === 0) return false;

	return buildPlanGenerationAnswers(snapshot).every((item) => item.answer);
};
