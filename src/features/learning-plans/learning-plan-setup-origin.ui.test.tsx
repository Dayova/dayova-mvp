import { describe, expect, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import { useLearningPlanSetupOrigin } from "./learning-plan-setup-origin";

describe("useLearningPlanSetupOrigin", () => {
	test("keeps a new-exam flow new after its draft id is added to the route", async () => {
		const screen = await renderHook(
			({ learningPlanId }: { learningPlanId?: Id<"learningPlans"> }) =>
				useLearningPlanSetupOrigin(learningPlanId),
			{ initialProps: { learningPlanId: undefined } },
		);

		expect(screen.result.current).toBe("newExam");

		await screen.rerender({
			learningPlanId: "new-draft" as Id<"learningPlans">,
		});

		expect(screen.result.current).toBe("newExam");
	});

	test("marks a draft supplied on entry as resumed", async () => {
		const screen = await renderHook(() =>
			useLearningPlanSetupOrigin("existing-draft" as Id<"learningPlans">),
		);

		expect(screen.result.current).toBe("resumedDraft");
	});
});
