import type { Id } from "#convex/_generated/dataModel";
import { useState } from "react";

export type LearningPlanSetupOrigin = "newExam" | "resumedDraft";

export function useLearningPlanSetupOrigin(
	learningPlanId: Id<"learningPlans"> | undefined,
): LearningPlanSetupOrigin {
	const [origin] = useState<LearningPlanSetupOrigin>(() =>
		learningPlanId ? "resumedDraft" : "newExam",
	);
	return origin;
}
