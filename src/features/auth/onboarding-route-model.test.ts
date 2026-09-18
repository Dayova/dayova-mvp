import { describe, expect, test } from "vitest";
import {
	getNextOnboardingStep,
	getOnboardingStepPath,
	getOnboardingStepProgress,
	isOnboardingStepId,
	ONBOARDING_PROFILE_STEPS,
	resolveOnboardingStepEntry,
} from "./onboarding-route-model";

describe("onboarding native route model", () => {
	test("keeps learning-time setup out of the profile/account sequence", () => {
		expect(ONBOARDING_PROFILE_STEPS.map((step) => step.id)).toEqual([
			"name",
			"grade",
			"state",
			"schoolType",
			"email",
			"password",
		]);
	});

	test("maps each action to a distinct native route and its successor", () => {
		expect(getOnboardingStepPath("name")).toBe("/onboarding/name");
		expect(getNextOnboardingStep("name")?.id).toBe("grade");
		expect(getNextOnboardingStep("password")).toBeNull();
		expect(getOnboardingStepProgress("name")).toEqual({
			progress: 1 / 6,
			stepCount: 6,
			stepNumber: 1,
		});
		expect(getOnboardingStepProgress("password")).toEqual({
			progress: 1,
			stepCount: 6,
			stepNumber: 6,
		});
	});

	test("rejects unknown or cold direct step entries", () => {
		expect(isOnboardingStepId("studyTime")).toBe(false);
		expect(isOnboardingStepId("unknown")).toBe(false);
		expect(
			resolveOnboardingStepEntry({
				requestedStep: "grade",
				visitedSteps: new Set(),
			}),
		).toEqual({ kind: "fallback", path: "/" });
		expect(
			resolveOnboardingStepEntry({
				requestedStep: "grade",
				visitedSteps: new Set(["grade"]),
			}),
		).toEqual({ kind: "step", stepId: "grade" });
	});
});
