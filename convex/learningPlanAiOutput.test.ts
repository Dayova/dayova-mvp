import { NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
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
	test("keeps the topic ID contract strict", () => {
		const output = fixture("m");
		output.topics[0].id = "größen-vergleichen";
		expect(schema.safeParse(output).success).toBe(false);
		output.topics[0].id = "groessen-vergleichen";
		expect(schema.safeParse(output).success).toBe(true);
	});
});

describe("knowledge-check generation recovery", () => {
	const malformedTopicId = () =>
		new NoObjectGeneratedError({
			message: "Topic ID failed schema validation",
			text: '{"topics":[{"id":"größen-vergleichen"}]}',
			response: { id: "qa", timestamp: new Date(0), modelId: "qa" },
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
	test("retries schema-invalid model output before returning a valid result", async () => {
		const generate = vi
			.fn()
			.mockRejectedValueOnce(malformedTopicId())
			.mockResolvedValueOnce({ topics: [{ id: "groessen-vergleichen" }] });
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			await expect(
				retry(generate, "Bitte erneut versuchen.", "generation_processing"),
			).resolves.toEqual({ topics: [{ id: "groessen-vergleichen" }] });
			expect(generate.mock.calls).toEqual([[0], [1]]);
		} finally {
			log.mockRestore();
		}
	});
	test("bounds malformed-output retries and preserves the safe error code", async () => {
		const generate = vi.fn().mockRejectedValue(malformedTopicId());
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			await expect(
				retry(generate, "Bitte erneut versuchen.", "generation_processing"),
			).rejects.toMatchObject({
				data: {
					message: "Bitte erneut versuchen.",
					code: "generation_processing",
				},
			});
			expect(generate).toHaveBeenCalledTimes(3);
		} finally {
			log.mockRestore();
		}
	});
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
