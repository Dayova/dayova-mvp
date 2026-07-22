import { describe, expect, test } from "vitest";
import { getLearningPlanCreationBackIntent } from "./creation-navigation";

describe("learning plan creation back intent", () => {
	test("moves directly to the preceding question after question one", () => {
		expect(
			getLearningPlanCreationBackIntent({
				questionIndex: 3,
				isPauseConfirmationVisible: false,
			}),
		).toEqual({ kind: "previousQuestion", questionIndex: 2 });
	});

	test("requests pause confirmation before leaving question one", () => {
		expect(
			getLearningPlanCreationBackIntent({
				questionIndex: 0,
				isPauseConfirmationVisible: false,
			}),
		).toEqual({ kind: "confirmPause" });
	});

	test("ignores another back intent while pause confirmation is visible", () => {
		expect(
			getLearningPlanCreationBackIntent({
				questionIndex: 0,
				isPauseConfirmationVisible: true,
			}),
		).toEqual({ kind: "ignore" });
	});
});
