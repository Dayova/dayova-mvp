import type { Id } from "#convex/_generated/dataModel";
import type { ValidationEventProperties } from "~/lib/analytics";
import { logDiagnosticError } from "~/lib/diagnostics";

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
	const logCaptureError = (error: unknown) => {
		logDiagnosticError("Failed to capture generated-plan analytics.", error, {
			source: "analytics.studyPlanGenerated",
			level: "warn",
		});
	};
	try {
		void Promise.resolve(
			capture("study_plan_generated", {
				learning_plan_id: args.learningPlanId,
				session_count: result.sessionCount,
			}),
		).catch(logCaptureError);
	} catch (error) {
		logCaptureError(error);
	}
	return result;
};
