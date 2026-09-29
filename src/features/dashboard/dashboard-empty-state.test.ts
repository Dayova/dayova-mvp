import { describe, expect, test } from "vitest";
import { ROUTES } from "~/lib/routes";
import {
	EMPTY_DASHBOARD_PRIMARY_ACTION,
	getDashboardNextStepFallbackAction,
} from "./dashboard-empty-state";

describe("empty dashboard handoff", () => {
	test("takes a newly onboarded learner directly to their first exam", () => {
		expect(EMPTY_DASHBOARD_PRIMARY_ACTION).toMatchObject({
			label: "Erste Prüfung planen",
			route: ROUTES.createExam,
		});
		expect(
			getDashboardNextStepFallbackAction({ hasLearningPlans: false }),
		).toBe(EMPTY_DASHBOARD_PRIMARY_ACTION);
	});

	test("keeps existing learners in their learning plans when no near-term step exists", () => {
		expect(
			getDashboardNextStepFallbackAction({ hasLearningPlans: true }),
		).toMatchObject({
			label: "Lernplan öffnen",
			route: ROUTES.learningPlans,
		});
	});
});
