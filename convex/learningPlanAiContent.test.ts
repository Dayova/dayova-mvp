import { describe, expect, test } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";
import { MAX_MULTIPLE_CHOICE_OPTION_CHARS } from "./learningSessionContentConstraints";

describe("learning plan AI practice content", () => {
	test("asks for an exhaustive capability-level exam topic map", () => {
		const instruction = __testOnlyLearningPlanAi.topicMapGenerationInstruction;

		expect(instruction).toContain("mindestens 6 Themen");
		expect(instruction).toContain("erklären");
		expect(instruction).toMatch(/anwenden|lösen/);
		expect(instruction).toContain("erfinde oder dupliziere aber keine Themen");
		expect(instruction).toContain("understanding und problemSolving");
	});

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
