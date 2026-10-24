import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
	buildCases,
	corpusSchema,
	modelConfigSchema,
	scoreCase,
} from "../ai/evaluation";

const { values } = parseArgs({
	options: {
		report: { type: "string" },
		corpus: { type: "string", default: "ai/evals/seed.json" },
		reviews: { type: "string" },
		check: { type: "boolean", default: false },
	},
});
const resultSchema = z.object({
	caseId: z.string(),
	model: z.string(),
	repetition: z.number(),
	output: z.unknown(),
	status: z.string(),
	costUsd: z.number().nullable(),
	scores: z.array(z.object({ name: z.string(), value: z.number() })),
});
const reportSchema = z.object({
	datasetVersion: z.string(),
	contractVersion: z.string(),
	corpusReviewStatus: z.string(),
	split: z.string(),
	completeSplit: z.boolean(),
	repetitions: z.number().int().positive(),
	candidates: z.array(modelConfigSchema).min(1),
	results: z.array(resultSchema).min(1),
});
const reviewSchema = z
	.object({
		reportHash: z.string(),
		reviewer: z.string().min(1),
		reviewedAt: z.string().datetime(),
		items: z
			.array(
				z.object({
					id: z.string(),
					correctness: z.boolean(),
					grounding: z.boolean(),
					answerability: z.boolean(),
					language: z.boolean(),
					comment: z.string(),
				}),
			)
			.min(1),
	})
	.strict();

const reviewId = (hash: string, index: number) =>
	createHash("sha256").update(`${hash}:${index}`).digest("hex").slice(0, 20);

async function main() {
	if (!values.report)
		throw new Error("Pass --report with the evaluation report path.");
	const text = await readFile(values.report, "utf8");
	const report = reportSchema.parse(JSON.parse(text));
	const reportHash = createHash("sha256").update(text).digest("hex");
	const corpusText = await readFile(values.corpus, "utf8");
	const corpus = corpusSchema.parse(JSON.parse(corpusText));
	const cases = buildCases(corpus);
	const caseById = (id: string) => {
		const item = cases.find((item) => item.id === id);
		if (!item) throw new Error("Unknown report case.");
		return item;
	};
	const version = createHash("sha256")
		.update(JSON.stringify(corpus))
		.update(JSON.stringify(cases))
		.digest("hex");
	if (version !== report.datasetVersion)
		throw new Error("Use the exact corpus version from the run.");
	if (values.check) {
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
		if (contractVersion !== report.contractVersion)
			throw new Error(
				"The prompt or evaluator contract changed; run a new evaluation.",
			);
		if (!values.reviews)
			throw new Error("Pass --reviews with the completed review file.");
		const reviews = reviewSchema.parse(
			JSON.parse(await readFile(values.reviews, "utf8")),
		);
		if (
			corpus.reviewStatus !== "reviewed" ||
			report.corpusReviewStatus !== "reviewed" ||
			report.split !== "holdout" ||
			!report.completeSplit
		)
			throw new Error(
				"Gate requires a reviewed corpus and the complete holdout split.",
			);
		if (reviews.reportHash !== reportHash)
			throw new Error("Reviews belong to a different report.");
		const expectedKeys = report.candidates.flatMap((candidate) =>
			cases
				.filter((item) => item.split === "holdout")
				.flatMap((item) =>
					Array.from(
						{ length: report.repetitions },
						(_, repetition) => `${candidate.id}/${item.id}/${repetition}`,
					),
				),
		);
		const actualKeys = report.results.map(
			(result) => `${result.model}/${result.caseId}/${result.repetition}`,
		);
		if (
			actualKeys.length !== expectedKeys.length ||
			new Set(actualKeys).size !== actualKeys.length ||
			expectedKeys.some((key) => !actualKeys.includes(key))
		)
			throw new Error("The report omits or duplicates held-out results.");
		const expectedIds = report.results.map((_, index) =>
			reviewId(reportHash, index),
		);
		if (
			reviews.items.length !== expectedIds.length ||
			new Set(reviews.items.map((item) => item.id)).size !==
				expectedIds.length ||
			expectedIds.some((id) => !reviews.items.some((item) => item.id === id))
		)
			throw new Error("Every output must have exactly one review.");
		const comparisons = report.candidates.map((candidate) => {
			const rows = report.results
				.map((row, index) => ({
					row,
					review: reviews.items.find(
						(item) => item.id === reviewId(reportHash, index),
					),
				}))
				.filter(({ row }) => row.model === candidate.id);
			const accepted = rows.filter(
				({ row, review }) =>
					row.status === "success" &&
					review?.correctness &&
					review.grounding &&
					review.answerability &&
					review.language &&
					scoreCase(caseById(row.caseId), row.output).every(
						(score) => score.value === 1,
					),
			).length;
			const cost = rows.reduce(
				(total, { row }) => total + (row.costUsd ?? 0),
				0,
			);
			const unknownCosts = rows.filter(
				({ row }) => row.costUsd === null,
			).length;
			return {
				model: candidate.id,
				accepted,
				total: rows.length,
				estimatedCostUsd: cost,
				unknownCosts,
				costPerAcceptedOutputUsd:
					accepted > 0 && unknownCosts === 0 ? cost / accepted : null,
			};
		});
		console.log(JSON.stringify(comparisons, null, 2));
		if (
			report.results.some(
				(result) =>
					result.status !== "success" ||
					result.costUsd === null ||
					result.scores.some((score) => score.value !== 1) ||
					scoreCase(caseById(result.caseId), result.output).some(
						(score) => score.value !== 1,
					),
			)
		)
			throw new Error("Automatic quality or accounting checks failed.");
		if (
			reviews.items.some(
				(item) =>
					!item.correctness ||
					!item.grounding ||
					!item.answerability ||
					!item.language,
			)
		)
			throw new Error("Human quality checks failed.");
		console.log(
			"Evaluation gate passed: automatic checks and complete human review.",
		);
		return;
	}
	const blinded = report.results.map((result, index) => {
		const item = cases.find((item) => item.id === result.caseId);
		return {
			id: reviewId(reportHash, index),
			caseId: result.caseId,
			prompt: item?.prompt,
			rubric: item?.rubric,
			expectedRating: item?.expectedRating,
			output: result.output,
			correctness: null,
			grounding: null,
			answerability: null,
			language: null,
			comment: "",
		};
	});
	// Stable shuffling prevents candidate order from revealing the provider.
	blinded.sort((a, b) =>
		createHash("sha256")
			.update(reportHash + a.id)
			.digest("hex")
			.localeCompare(
				createHash("sha256")
					.update(reportHash + b.id)
					.digest("hex"),
			),
	);
	await writeFile(
		`${values.report}.review.json`,
		JSON.stringify(
			{ reportHash, reviewer: "", reviewedAt: "", items: blinded },
			null,
			2,
		),
		{ flag: "wx" },
	);
	console.log(
		`Review template: ${values.report}.review.json. Keep the source report private from the blinded reviewer.`,
	);
}
main().catch((error) => {
	console.error(
		error instanceof z.ZodError
			? "Incomplete or invalid review/report."
			: (error as Error).message,
	);
	process.exitCode = 1;
});
