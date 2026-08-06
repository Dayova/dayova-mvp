import { describe, expect, test } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";
import { MAX_MULTIPLE_CHOICE_OPTION_CHARS } from "./learningSessionContentConstraints";

describe("learning plan AI practice content", () => {
	test("rejects voice as a generated practice response mode", () => {
		const result = __testOnlyLearningPlanAi.generatedTaskItemSchema.safeParse({
			kind: "voice",
			title: "Aufgabe erklären",
			prompt: "Erkläre die passende Lösung für diese konkrete Aufgabe.",
			explanation:
				"Die Lösung verwendet den entscheidenden fachlichen Schritt.",
			idealAnswer: "Eine passende schriftliche Lösung.",
			keywords: ["Lösung"],
		});

		expect(result.success).toBe(false);
	});

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
