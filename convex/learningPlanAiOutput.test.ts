import { NoOutputGeneratedError } from "ai";
import { describe, expect, test, vi } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

const retry = __testOnlyLearningPlanAi.withGeneratedTextRetry;

describe("knowledge-check generation recovery", () => {
	test("retries an empty structured model response before returning a valid result", async () => {
		const generate = vi
			.fn()
			.mockRejectedValueOnce(new NoOutputGeneratedError())
			.mockResolvedValueOnce({ questions: ["valid"] });
		await expect(retry(generate, "Bitte erneut versuchen.")).resolves.toEqual({
			questions: ["valid"],
		});
		expect(generate).toHaveBeenCalledTimes(2);
	});
	test("bounds retries and returns an actionable error on persistent empty output", async () => {
		const generate = vi.fn().mockRejectedValue(new NoOutputGeneratedError());
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			await expect(
				retry(generate, "Bitte erneut versuchen."),
			).rejects.toMatchObject({ data: { message: "Bitte erneut versuchen." } });
			expect(generate).toHaveBeenCalledTimes(3);
		} finally {
			log.mockRestore();
		}
	});
	test("does not retry unrelated permission or network failures", async () => {
		const failure = new Error("Permission denied");
		const generate = vi.fn().mockRejectedValue(failure);
		await expect(retry(generate, "Bitte erneut versuchen.")).rejects.toBe(
			failure,
		);
		expect(generate).toHaveBeenCalledTimes(1);
	});
});
