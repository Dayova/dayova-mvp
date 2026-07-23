import { expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { learningPlanTopicPath } from "./creation-routes";

test("keeps upload and topic on the same mounted setup screen", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(learningPlanTopicPath(learningPlanId)).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=topic",
	);
});
