import { NoObjectGeneratedError } from "ai";
import { expect, test, vi } from "vitest";
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
