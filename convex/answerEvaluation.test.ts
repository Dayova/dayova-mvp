import { describe, expect, test } from "vitest";
import {
	evaluateMultipleChoiceAnswer,
	isUnknownWrittenAnswer,
} from "./answerEvaluation";

describe("answer evaluation", () => {
	test("grades multiple choice deterministically and explains the result", () => {
		expect(
			evaluateMultipleChoiceAnswer({
				selectedChoiceId: "correct",
				correctChoiceId: "correct",
				explanation: "Zero Clients schützt sensible Systeme.",
			}),
		).toEqual({
			rating: "correct",
			review:
				"Deine Auswahl ist richtig. Zero Clients schützt sensible Systeme.",
		});

		expect(
			evaluateMultipleChoiceAnswer({
				selectedChoiceId: "wrong",
				correctChoiceId: "correct",
				explanation: "Zero Clients schützt sensible Systeme.",
			}),
		).toEqual({
			rating: "notCorrect",
			review:
				"Deine Auswahl ist nicht richtig. Zero Clients schützt sensible Systeme.",
		});
	});

	test("recognizes explicit unknown written answers", () => {
		expect(isUnknownWrittenAnswer("Weiß ich nicht")).toBe(true);
		expect(isUnknownWrittenAnswer("  keine   Ahnung ")).toBe(true);
		expect(isUnknownWrittenAnswer("Ich kenne den ersten Schritt.")).toBe(false);
	});
});
