import { describe, expect, test } from "vitest";
import { getLearningPlanCreationBackIntent } from "./creation-navigation";

describe("learning plan creation back intent", () => {
	test("moves directly to the previous setup step", () => {
		expect(
			getLearningPlanCreationBackIntent({
				step: "materialUpload",
				hasSavedDraft: true,
				isPauseConfirmationVisible: false,
			}),
		).toEqual({ kind: "previousStep", step: "requiredTopics" });
	});

	test("confirms before pausing a saved draft from the first step", () => {
		expect(
			getLearningPlanCreationBackIntent({
				step: "requiredTopics",
				hasSavedDraft: true,
				isPauseConfirmationVisible: false,
			}),
		).toEqual({ kind: "confirmPause" });
	});

	test("exits an unsaved first step without creating an empty draft", () => {
		expect(
			getLearningPlanCreationBackIntent({
				step: "requiredTopics",
				hasSavedDraft: false,
				isPauseConfirmationVisible: false,
			}),
		).toEqual({ kind: "exit" });
	});

	test("ignores duplicate back intents while confirmation is visible", () => {
		expect(
			getLearningPlanCreationBackIntent({
				step: "requiredTopics",
				hasSavedDraft: true,
				isPauseConfirmationVisible: true,
			}),
		).toEqual({ kind: "ignore" });
	});
});
