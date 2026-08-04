import { expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import {
	learningPlanResumePath,
	learningPlanTopicPath,
} from "./creation-routes";

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

test("resumes creation without routing through a separate question screen", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(learningPlanResumePath(learningPlanId, "questionsReady")).toBe(
		"/learning-plans/learning-plan-id/analysis",
	);
	expect(learningPlanResumePath(learningPlanId, "generated")).toBe(
		"/learning-plans/learning-plan-id/analysis",
	);
	expect(
		learningPlanResumePath(learningPlanId, "generated", "firstSession"),
	).toBe("/learning-plans/learning-plan-id/review");
});
