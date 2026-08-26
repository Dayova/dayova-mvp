import type { Id } from "#convex/_generated/dataModel";
import { getSafeReturnTo, ROUTES } from "~/lib/routes";

export const getLearningSessionBackTarget = (
	planId?: Id<"learningPlans">,
	returnTo?: string,
) => {
	const safeReturnTo = getSafeReturnTo(returnTo);
	if (safeReturnTo) return safeReturnTo;

	return planId ? `/learning-plans/${planId}` : ROUTES.learningPlans;
};
