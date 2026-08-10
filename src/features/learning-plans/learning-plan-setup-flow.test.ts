import { describe, expect, test } from "vitest";
import {
	getInitialLearningPlanSetupStep,
	getNextLearningPlanSetupStep,
	getPreviousLearningPlanSetupStep,
} from "./learning-plan-setup-flow";

describe("learning-plan setup flow", () => {
	test("starts with teacher guidance before school material", () => {
		expect(getInitialLearningPlanSetupStep({ hasError: false })).toBe(
			"teacherGuidance",
		);
		expect(getNextLearningPlanSetupStep("teacherGuidance")).toBe(
			"materialUpload",
		);
		expect(getNextLearningPlanSetupStep("materialUpload")).toBeNull();
	});

	test("returns from material to teacher guidance", () => {
		expect(getPreviousLearningPlanSetupStep("materialUpload")).toBe(
			"teacherGuidance",
		);
		expect(getPreviousLearningPlanSetupStep("teacherGuidance")).toBeNull();
	});

	test("opens the material step when returning from analysis or an error", () => {
		expect(
			getInitialLearningPlanSetupStep({
				hasError: false,
				routeStep: "material",
			}),
		).toBe("materialUpload");
		expect(
			getInitialLearningPlanSetupStep({
				hasError: true,
				routeStep: "topic",
			}),
		).toBe("materialUpload");
	});
});
