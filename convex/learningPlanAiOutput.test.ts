import { NoOutputGeneratedError } from "ai";
import { describe, expect, test, vi } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

const retry = __testOnlyLearningPlanAi.withGeneratedTextRetry;

describe("diagnostic topic keywords", () => {
	const schema = __testOnlyLearningPlanAi.questionsSchema;
	const fixture = (keyword: string) => ({
		sourceSummary:
			"Lineare Funktionen mit Steigung und Achsenabschnitt untersuchen.",
		topics: ["steigung", "achsenabschnitt", "funktionswert"].map((id) => ({
			id,
			title: "Lineare Funktionen",
			learningGoal: "Die Parameter einer linearen Funktion bestimmen.",
			keywords: ["Funktion", keyword],
			priority: "high",
			requiredEvidenceDimensions: ["understanding", "problemSolving"],
		})),
		questions: Array.from({ length: 5 }, () => ({
			topicId: "steigung",
			kind: "performance",
			evidenceDimension: "problemSolving",
			responseKind: "shortText",
			options: [],
			correctOptionIndex: null,
			prompt: "Welche Steigung hat y = 2x + 3?",
			targetInsight: "Die Steigung aus der Gleichung ablesen.",
			idealAnswer: "2",
			explanation: "Die Zahl vor x ist die Steigung der Geraden.",
			evaluationKeywords: ["2"],
		})),
	});

	test.each([
		"m",
		"b",
		"x",
		"π",
	])("accepts the subject symbol %s", (keyword) => {
		expect(schema.safeParse(fixture(keyword)).success).toBe(true);
	});
	test.each(["", " ", "\t\n"])("rejects empty keyword %j", (keyword) => {
		expect(schema.safeParse(fixture(keyword)).success).toBe(false);
	});
});

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
