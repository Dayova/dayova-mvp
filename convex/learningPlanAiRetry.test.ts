import { NoObjectGeneratedError } from "ai";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import { InvalidGeneratedGermanTextError } from "./generatedGermanText";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

const { withGeneratedTextRetry, DuplicateGeneratedPromptError } =
	__testOnlyLearningPlanAi;
const schemaError = () =>
	new NoObjectGeneratedError({
		text: '{"questions": []}',
		cause: new Error("Expected ten questions"),
		response: { id: "test", timestamp: new Date(), modelId: "test" },
		usage: {
			inputTokens: 1,
			outputTokens: 1,
			totalTokens: 2,
			inputTokenDetails: {
				noCacheTokens: 1,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			},
			outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
		},
		finishReason: "stop",
	});
test("schema failure is retried before user-facing conversion", async () => {
	const task = vi
		.fn()
		.mockRejectedValueOnce(schemaError())
		.mockResolvedValue("ten questions");
	await expect(
		withGeneratedTextRetry(task, "Bitte erneut versuchen."),
	).resolves.toBe("ten questions");
	expect(task.mock.calls).toEqual([[0], [1]]);
});
test("schema failures stop after three attempts and return the safe message", async () => {
	const task = vi.fn().mockRejectedValue(schemaError());
	await expect(
		withGeneratedTextRetry(task, "Bitte erneut versuchen."),
	).rejects.toThrow("Bitte erneut versuchen.");
	expect(task).toHaveBeenCalledTimes(3);
});
test("duplicate prompts are still retried", async () => {
	const task = vi
		.fn()
		.mockRejectedValueOnce(new DuplicateGeneratedPromptError())
		.mockResolvedValue("unique");
	await expect(withGeneratedTextRetry(task, "Fehler")).resolves.toBe("unique");
	expect(task).toHaveBeenCalledTimes(2);
});
test("unrelated errors are not retried or masked", async () => {
	const error = new Error("network");
	const task = vi.fn().mockRejectedValue(error);
	await expect(withGeneratedTextRetry(task, "Fehler")).rejects.toBe(error);
	expect(task).toHaveBeenCalledTimes(1);
});

test("invalid German output is still retried", async () => {
	const task = vi
		.fn()
		.mockRejectedValueOnce(new InvalidGeneratedGermanTextError())
		.mockResolvedValue("gültig");
	await expect(withGeneratedTextRetry(task, "Fehler")).resolves.toBe("gültig");
	expect(task).toHaveBeenCalledTimes(2);
});

test("incomplete sufficient material is retried and exhausted attempts retain their failure code", async () => {
	const task = vi
		.fn()
		.mockRejectedValue(
			new __testOnlyLearningPlanAi.IncompleteGeneratedMaterialError(),
		);
	await expect(
		withGeneratedTextRetry(
			task,
			"Bitte erneut versuchen.",
			"generation_processing",
		),
	).rejects.toMatchObject({ data: { code: "generation_processing" } });
	expect(task).toHaveBeenCalledTimes(3);
});

test("material assessment permits empty failure output while sufficient material requires ten questions", () => {
	const question = {
		topicId: "steigung",
		kind: "performance",
		evidenceDimension: "understanding",
		responseKind: "shortText",
		options: [],
		correctOptionIndex: null,
		prompt: "Berechne die Steigung der Geraden.",
		targetInsight: "Steigung berechnen",
		idealAnswer: "2",
		explanation: "Die Steigung beträgt zwei.",
		evaluationKeywords: ["Steigung"],
	};
	const output = {
		materialAssessment: { verdict: "sufficient", missingInformation: "" },
		sourceSummary: "Lineare Funktionen.",
		topics: [],
		questions: Array.from({ length: 10 }, () => question),
	};
	const { questionsSchema } = __testOnlyLearningPlanAi;
	expect(questionsSchema.safeParse(output).success).toBe(true);
	expect(
		questionsSchema.safeParse({
			...output,
			questions: output.questions.slice(0, 5),
		}).success,
	).toBe(false);
	expect(
		questionsSchema.safeParse({
			...output,
			materialAssessment: {
				verdict: "insufficient",
				missingInformation: "Es fehlen Aufgaben zur Steigung.",
			},
			questions: [],
		}).success,
	).toBe(true);
	expect(() => z.toJSONSchema(questionsSchema)).not.toThrow();
});
