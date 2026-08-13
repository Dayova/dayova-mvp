import { expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import {
	examEntrySuccessPath,
	learningPlanMaterialPath,
	learningPlanResumePath,
	learningPlanTopicsPath,
} from "./creation-routes";

test("builds the exam confirmation route for a saved materialless exam", () => {
	expect(
		examEntrySuccessPath({
			dayKey: "2026-08-12",
			examDateLabel: "12. August 2026",
		}),
	).toBe(
		"/entry/success?type=exam&dayKey=2026-08-12&examDateLabel=12.%20August%202026",
	);
});

test("routes explicitly between topics and material on the mounted setup screen", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(learningPlanTopicsPath(learningPlanId)).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=topic",
	);
	expect(learningPlanMaterialPath(learningPlanId)).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=material",
	);
});

test("preserves required topics when returning to the first step", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(
		learningPlanTopicsPath(learningPlanId, {
			topicDescription: "Kapitel 3 & 4, ohne Beweise",
		}),
	).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=topic&topicDescription=Kapitel%203%20%26%204%2C%20ohne%20Beweise",
	);
});

test("resumes creation without routing through a separate question screen", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(learningPlanResumePath(learningPlanId, "draft")).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=material",
	);
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
