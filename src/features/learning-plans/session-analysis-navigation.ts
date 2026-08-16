import type { Id } from "#convex/_generated/dataModel";
import { ROUTES } from "~/lib/routes";

export const getLearningSessionAnalysisDestination = (
	planId?: Id<"learningPlans">,
) =>
	planId
		? { pathname: ROUTES.analytics, params: { planId } }
		: ROUTES.analytics;
