import type { Id } from "#convex/_generated/dataModel";
import { ROUTES } from "~/lib/routes";

export const learningPlanStepPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export const learningPlanUploadPath = (id: Id<"learningPlans">) =>
	`${ROUTES.createLearningPlan}?learningPlanId=${encodeURIComponent(id)}` as const;

export const learningPlanTopicPath = (
	id: Id<"learningPlans">,
	params: {
		topicDescription?: string;
		errorMessage?: string;
	} = {},
) => {
	const query = [
		["learningPlanId", id],
		["topicDescription", params.topicDescription],
		["errorMessage", params.errorMessage],
	]
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
		.join("&");

	return `${ROUTES.createLearningPlanTopic}?${query}` as const;
};
