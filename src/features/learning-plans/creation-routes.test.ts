import { expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import {
	examEntryResumePath,
	examEntrySuccessPath,
	learningPlanMaterialPath,
	learningPlanResumePath,
} from "./creation-routes";

test("preserves a personal subject when resuming exam creation", () => {
	expect(
		examEntryResumePath({
			examDayEntryId: "exam-id",
			subject: "Astronomie",
			personalSubjectId: "personal-subject-id",
			examTypeLabel: "Klausur",
			examDateKey: "2026-09-30",
			durationMinutes: 90,
			topicDescription: "Sternentwicklung",
		}),
	).toContain("personalSubjectId=personal-subject-id");
});

test("preserves a one-time subject when resuming exam creation", () => {
	expect(
		examEntryResumePath({
			examDayEntryId: "exam-id",
			subject: "Debattieren",
			subjectIsOneTime: true,
			examTypeLabel: "Präsentation",
			examDateKey: "2026-10-12",
			durationMinutes: 20,
			topicDescription: "Argumentationsstruktur",
		}),
	).toContain("subjectIsOneTime=true");
});

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

test("routes to material on the mounted setup screen", () => {
	const learningPlanId = "learning-plan-id" as Id<"learningPlans">;
	expect(learningPlanMaterialPath(learningPlanId)).toBe(
		"/learning-plans/new?learningPlanId=learning-plan-id&step=material",
	);
});
