import { expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import {
	examEntrySuccessPath,
	learningPlanMaterialPath,
	learningPlanResumePath,
} from "./creation-routes";

test("builds the exam confirmation route for a saved materialless plan", () => {
	expect(
		examEntrySuccessPath({
			dayKey: "2026-08-12",
			examDateLabel: "12. August 2026",
		}),
	).toBe(
		"/entry/success?type=exam&dayKey=2026-08-12&examDateLabel=12.%20August%202026",
	);
});

test("returns to material on the same mounted setup screen", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(learningPlanMaterialPath(learningPlanId)).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=material",
	);
});

test("preserves the teacher guidance when returning to school material", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(
		learningPlanMaterialPath(learningPlanId, {
			teacherGuidance: "Kapitel 3 & 4, ohne Beweise",
		}),
	).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=material&teacherGuidance=Kapitel%203%20%26%204%2C%20ohne%20Beweise",
	);
});

test("resumes creation without routing through a separate question screen", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;

	expect(learningPlanResumePath(learningPlanId, "draft")).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id",
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
