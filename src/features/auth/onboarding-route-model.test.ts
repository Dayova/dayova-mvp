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
	test("keeps the accepted 14-step profile/account sequence", () => {
		expect(ONBOARDING_PROFILE_STEPS.map((step) => step.id)).toEqual([
			"name",
			"studyTime",
			"study-time-fact",
			"studyDays",
			"learningTime",
			"learning-time-payoff",
			"grade",
			"state",
			"schoolType",
			"birthYear",
			"birthMonth",
			"birthDay",
			"email",
			"password",
		]);
	});

	test("maps each action to a distinct native route and its successor", () => {
		expect(getOnboardingStepPath("name")).toBe("/onboarding/name");
		expect(getNextOnboardingStep("name")?.id).toBe("studyTime");
		expect(getNextOnboardingStep("password")).toBeNull();
		expect(getOnboardingStepProgress("name")).toEqual({
			progress: 1 / 14,
			stepCount: 14,
			stepNumber: 1,
		});
		expect(getOnboardingStepProgress("password")).toEqual({
			progress: 1,
			stepCount: 14,
			stepNumber: 14,
		});
	});

	test("rejects unknown or cold direct step entries", () => {
		expect(isOnboardingStepId("studyTime")).toBe(true);
		expect(isOnboardingStepId("unknown")).toBe(false);
		expect(
			resolveOnboardingStepEntry({
				requestedStep: "studyTime",
				visitedSteps: new Set(),
			}),
		).toEqual({ kind: "fallback", path: "/" });
		expect(
			resolveOnboardingStepEntry({
				requestedStep: "studyTime",
				visitedSteps: new Set(["studyTime"]),
			}),
		).toEqual({ kind: "step", stepId: "studyTime" });
	});
});
