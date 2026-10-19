// @vitest-environment node
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import {
	buildCases,
	corpusSchema,
	type EvaluationCase,
	scoreCase,
} from "../ai/evaluation";

const execute = promisify(execFile);
const outputFor = (item: EvaluationCase): unknown => {
	const text =
		"Eine ausreichend ausführliche Erklärung für diesen synthetischen Strukturtest.";
	if (item.operation === "answer_evaluation")
		return { rating: item.expectedRating, review: text };
	if (item.operation === "session_theory")
		return {
			items: [
				{
					conceptTitle: "Konzept",
					question: "Was vermutest du bei diesem Beispiel?",
					explanation: text,
					keyPoints: [text],
					example: text,
					memoryCue: "Merke dir diesen Zusammenhang.",
					commonMistake: text,
					keywords: ["Konzept"],
				},
			],
		};
	if (
		item.operation === "session_practice" ||
		item.operation === "session_praxis"
	)
		return {
			items: [
				{
					kind:
						item.operation === "session_practice"
							? "multipleChoice"
							: "written",
					title: "Konzept",
					prompt: "Welche Aussage beschreibt den Zusammenhang?",
					explanation: text,
					idealAnswer: "A",
					keywords: ["Konzept"],
					...(item.operation === "session_practice"
						? {
								choices: [
									{ text: "A", isCorrect: true },
									{ text: "B", isCorrect: false },
									{ text: "C", isCorrect: false },
									{ text: "D", isCorrect: false },
								],
							}
						: {}),
				},
			],
		};
	if (item.operation === "plan")
		return {
			sourceSummary: text,
			insight: { summary: text, strengths: [], gaps: [text] },
			sessions: [
				{
					phase: "theory",
					title: "Konzept",
					dayOffsetBeforeExam: 1,
					startTime: "16:00",
					durationMinutes: 20,
					goal: text,
					tasks: [text, "Bearbeite ein weiteres Beispiel."],
					expectedOutcome: text,
				},
			],
		};
	return {
		sourceSummary: text,
		topics: Array.from({ length: 3 }, (_, index) => ({
			id: `topic-${index}`,
			title: "Konzept",
			learningGoal: text,
			keywords: ["Konzept"],
			priority: "high",
			requiredEvidenceDimensions: ["understanding"],
		})),
		questions: Array.from({ length: 10 }, (_, index) => ({
			topicId: `topic-${index % 3}`,
			kind: "performance",
			evidenceDimension: "understanding",
			responseKind: index < 2 ? "multipleChoice" : "shortText",
			options: index < 2 ? ["A", "B", "C"] : [],
			correctOptionIndex: index < 2 ? 0 : null,
			prompt: `Welche Aussage passt zum Beispiel ${index + 1}?`,
			targetInsight: text,
			idealAnswer: "A",
			explanation: text,
			evaluationKeywords: ["Konzept"],
		})),
	};
};

test("review gate verifies complete held-out outputs, matching reviews, and current automatic scores", {
	timeout: 70_000,
}, async () => {
	const directory = await mkdtemp(join(tmpdir(), "dayova-ai-review-"));
	const corpus = corpusSchema.parse({
		...JSON.parse(await readFile("ai/evals/seed.json", "utf8")),
		reviewStatus: "reviewed",
		reviewedBy: "test-fixture",
		reviewedAt: "2026-10-18T00:00:00.000Z",
	});
	const corpusText = JSON.stringify(corpus);
	const corpusPath = join(directory, "corpus.json");
	await writeFile(corpusPath, corpusText);
	const cases = buildCases(corpus);
	const datasetVersion = createHash("sha256")
		.update(JSON.stringify(corpus))
		.update(JSON.stringify(cases))
		.digest("hex");
	const contractVersion = createHash("sha256")
		.update(
			(await readFile("ai/learningContracts.ts", "utf8")).replaceAll(
				"\r\n",
				"\n",
			),
		)
		.update(
			(await readFile("ai/evaluation.ts", "utf8")).replaceAll("\r\n", "\n"),
		)
		.digest("hex");
	const results = cases
		.filter((item) => item.split === "holdout")
		.map((item) => ({
			caseId: item.id,
			model: "mock",
			repetition: 0,
			status: "success",
			costUsd: 0.001,
			output: outputFor(item),
			scores: [
				{ name: "request_success", value: 1 },
				...scoreCase(item, outputFor(item)),
			],
		}));
	const report = {
		datasetVersion,
		contractVersion,
		corpusReviewStatus: "reviewed",
		split: "holdout",
		completeSplit: true,
		repetitions: 1,
		candidates: [{ id: "mock", provider: "openai", model: "mock" }],
		results,
	};
	const reportPath = join(directory, "report.json");
	const reviewsPath = `${reportPath}.review.json`;
	const args = [
		"--import",
		"tsx",
		"scripts/ai-eval-review.ts",
		"--corpus",
		corpusPath,
		"--report",
		reportPath,
	];
	const createReviews = async () => {
		await writeFile(reportPath, JSON.stringify(report));
		await execute(process.execPath, args, { timeout: 20_000 });
		const review = JSON.parse(await readFile(reviewsPath, "utf8"));
		review.reviewer = "test-reviewer";
		review.reviewedAt = "2026-10-18T00:00:00.000Z";
		for (const item of review.items)
			Object.assign(item, {
				correctness: true,
				grounding: true,
				answerability: true,
				language: true,
			});
		await writeFile(reviewsPath, JSON.stringify(review));
		return review;
	};
	const checkArgs = [...args, "--reviews", reviewsPath, "--check"];
	const review = await createReviews();
	const accepted = await execute(process.execPath, checkArgs, {
		timeout: 20_000,
	});
	expect(accepted.stdout).toContain("Evaluation gate passed");
	expect(accepted.stdout).toContain("costPerAcceptedOutputUsd");
	await expect(
		execute(process.execPath, args, { timeout: 20_000 }),
	).rejects.toMatchObject({ stderr: expect.stringContaining("EEXIST") });
	review.items.pop();
	await writeFile(reviewsPath, JSON.stringify(review));
	await expect(
		execute(process.execPath, checkArgs, { timeout: 20_000 }),
	).rejects.toMatchObject({
		stderr: expect.stringContaining(
			"Every output must have exactly one review",
		),
	});
	// A corrupted report cannot bypass the gate by retaining old passing scores.
	report.results[0].output = {};
	await unlink(reviewsPath);
	await createReviews();
	await expect(
		execute(process.execPath, checkArgs, { timeout: 20_000 }),
	).rejects.toMatchObject({
		stderr: expect.stringContaining(
			"Automatic quality or accounting checks failed",
		),
	});
});
