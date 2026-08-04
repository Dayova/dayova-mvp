import type { Id } from "#convex/_generated/dataModel";
import { ROUTES } from "~/lib/routes";

export const learningPlanStepPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export const learningPlanResumePath = (
	id: Id<"learningPlans">,
	status: "draft" | "questionsReady" | "generated" | "accepted",
	diagnosticPlacement?: "firstSession",
) => {
	if (status === "draft") {
		return `${ROUTES.createLearningPlan}?learningPlanId=${encodeURIComponent(id)}` as const;
	}
	if (status === "questionsReady") {
		return learningPlanStepPath(id, "analysis");
	}
	if (status === "generated") {
		return learningPlanStepPath(
			id,
			diagnosticPlacement === "firstSession" ? "review" : "analysis",
		);
	}

	return `/learning-plans/${id}` as const;
};

export const learningPlanTopicPath = (
	id: Id<"learningPlans">,
	params: {
		topicDescription?: string;
		teacherGuidance?: string;
		errorMessage?: string;
	} = {},
) => {
	const query = [
		["learningPlanId", id],
		["step", "topic"],
		["topicDescription", params.topicDescription],
		["teacherGuidance", params.teacherGuidance],
		["errorMessage", params.errorMessage],
	]
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
		.join("&");

	return `${ROUTES.createLearningPlan}?${query}` as const;
};
