import { expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { learningPlanTopicPath } from "./creation-routes";

test("keeps upload and topic on the same mounted setup screen", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(learningPlanTopicPath(learningPlanId)).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=topic",
	);
});

test("preserves the teacher guidance when returning to exam evidence", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(
		learningPlanTopicPath(learningPlanId, {
			teacherGuidance: "Kapitel 3 & 4, ohne Beweise",
		}),
	).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=topic&teacherGuidance=Kapitel%203%20%26%204%2C%20ohne%20Beweise",
	);
});
