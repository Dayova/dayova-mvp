import type { Id } from "#convex/_generated/dataModel";
import type { ValidationEventProperties } from "~/lib/analytics";

type GeneratedPlan = {
	sessionCount: number;
};

type StudyPlanGeneratedCapture = (
	eventName: "study_plan_generated",
	properties: ValidationEventProperties["study_plan_generated"],
) => void | Promise<void>;

export const generatePlanWithAnalytics = async <
	Args extends { learningPlanId: Id<"learningPlans"> },
>({
	generatePlan,
	capture,
	args,
}: {
	generatePlan: (args: Args) => Promise<GeneratedPlan>;
	capture: StudyPlanGeneratedCapture;
	args: Args;
}) => {
	const result = await generatePlan(args);
	void capture("study_plan_generated", {
		learning_plan_id: args.learningPlanId,
		session_count: result.sessionCount,
	});
	return result;
};
