import { describe, expect, test } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";
import { MAX_MULTIPLE_CHOICE_OPTION_CHARS } from "./learningSessionContentConstraints";

describe("learning plan AI practice content", () => {
	test("accepts a usable model-generated choice that is longer than the UI limit", () => {
		const result = __testOnlyLearningPlanAi.generatedTaskChoiceSchema.safeParse(
			{
				text: "Tower-PCs werden für lokale Rechenleistung an einzelnen Arbeitsplätzen eingesetzt.",
				isCorrect: false,
			},
		);

		expect(result.success).toBe(true);
	});

	test("compacts long generated choices before storing them for the UI", () => {
		const choice = __testOnlyLearningPlanAi.normalizeTaskChoiceText(
			"Tower-PCs werden für lokale Rechenleistung an einzelnen Arbeitsplätzen eingesetzt.",
		);

		expect(choice.length).toBeLessThanOrEqual(MAX_MULTIPLE_CHOICE_OPTION_CHARS);
		expect(choice).toMatch(/…$/);
	});
});
