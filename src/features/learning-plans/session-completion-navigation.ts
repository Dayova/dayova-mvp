import type { Id } from "#convex/_generated/dataModel";
import { ROUTES } from "~/lib/routes";

export const getLearningSessionCompletionDestination = (
	planId?: Id<"learningPlans">,
) =>
	planId
		? { pathname: "/learning-plans/[planId]" as const, params: { planId } }
		: ROUTES.learningPlans;
