// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
	aggregateScores,
	buildCases,
	corpusSchema,
	evaluationContract,
	scoreCase,
} from "../ai/evaluation";
import {
	buildWrittenAnswerPrompt,
	writtenAnswerEvaluationSchema,
} from "../ai/learningContracts";

const corpus = corpusSchema.parse(
	JSON.parse(
		readFileSync(new URL("../ai/evals/seed.json", import.meta.url), "utf8"),
	),
);
const cases = buildCases(corpus);
test("the seed covers all six operations and separates sources across splits", () => {
	expect(cases).toHaveLength(90);
	expect(new Set(cases.map((item) => item.id)).size).toBe(90);
	expect(new Set(cases.map((item) => item.operation)).size).toBe(6);
	for (const source of corpus.materials)
		expect(
			new Set(
				cases
					.filter((item) => item.sourceId === source.id)
					.map((item) => item.split),
			).size,
		).toBe(1);
	expect(cases.filter((item) => item.split === "holdout")).toHaveLength(18);
	expect(corpus.reviewStatus).toBe("seed");
});
test("reviewed corpora need an accountable reviewer and source IDs cannot leak between splits", () => {
	expect(
		corpusSchema.safeParse({ ...corpus, reviewStatus: "reviewed" }).success,
	).toBe(false);
	expect(
		corpusSchema.safeParse({
			...corpus,
			materials: [
				...corpus.materials,
				{ ...corpus.materials[0], split: "holdout" },
			],
		}).success,
	).toBe(false);
});
test("grading uses the production prompt and schema and penalizes incorrect labels", () => {
	const item = cases.find(
		(item) => item.id === "linear-functions-grading-partial",
	);
	if (!item) throw new Error("Fixture missing");
	expect(evaluationContract(item.operation).schema).toBe(
		writtenAnswerEvaluationSchema,
	);
	expect(item.prompt).toContain(
		"Die Steigung ist 2. Den Funktionswert habe ich noch nicht berechnet.",
	);
	expect(buildWrittenAnswerPrompt).toBeTypeOf("function");
	expect(
		scoreCase(item, {
			rating: "correct",
			review: "Das stimmt vollständig.",
		}).find((score) => score.name === "grading_accuracy")?.value,
	).toBe(0);
	expect(
		scoreCase(item, {
			rating: "partiallyCorrect",
			review: "Die Steigung stimmt, der Funktionswert 11 fehlt.",
		}).every((score) => score.value === 1),
	).toBe(true);
});
test("multiple correct answers and duplicate distractors fail the MCQ check", () => {
	const item = cases.find((item) => item.operation === "session_practice");
	if (!item) throw new Error("Fixture missing");
	const task = {
		kind: "multipleChoice",
		title: "Steigung",
		prompt: "Welche Steigung hat y = 2x + 3?",
		explanation: "Die Zahl vor x gibt die Steigung an.",
		idealAnswer: "2",
		keywords: ["Steigung"],
		choices: [
			{ text: "2", isCorrect: true },
			{ text: "3", isCorrect: true },
		],
	};
	expect(
		scoreCase(item, { items: [task] }).find(
			(score) => score.name === "one_correct_mcq",
		)?.value,
	).toBe(0);
	task.choices[1] = { text: "2", isCorrect: false };
	expect(
		scoreCase(item, { items: [task] }).find(
			(score) => score.name === "one_correct_mcq",
		)?.value,
	).toBe(0);
});
test("malformed or missing outputs fail schema validation", () => {
	for (const item of cases)
		expect(scoreCase(item, undefined)).toEqual([{ name: "schema", value: 0 }]);
});

test("score summaries expose both evaluated samples and whole-run failure penalties", () => {
	expect(
		aggregateScores([
			{ scores: [{ name: "quality", value: 1 }] },
			{ scores: [{ name: "quality", value: 0 }] },
			{ scores: [] },
		]),
	).toEqual([{ name: "quality", samples: 2, mean: 0.5, endToEndMean: 1 / 3 }]);
});
