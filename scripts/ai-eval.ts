import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
import { LangfuseClient } from "@langfuse/client";
import { context } from "@opentelemetry/api";
import {
	generateText,
	type LanguageModelUsage,
	NoObjectGeneratedError,
	Output,
} from "ai";
import { z } from "zod";
import {
	aggregateScores,
	buildCases,
	corpusSchema,
	type EvaluationCase,
	evaluationContract,
	type ModelConfig,
	modelConfigSchema,
	scoreCase,
} from "../ai/evaluation";
import {
	aiErrorCategory,
	observeAiModel,
	registerEvaluationTelemetry,
	withAiOperation,
} from "../ai/observability";
import { costForUsage } from "../ai/usage";

const { values } = parseArgs({
	options: {
		live: { type: "boolean", default: false },
		publish: { type: "boolean", default: false },
		corpus: { type: "string", default: "ai/evals/seed.json" },
		config: { type: "string", default: "ai/evals/models.json" },
		models: { type: "string", default: "baseline,flash-lite-3.5" },
		split: { type: "string", default: "development" },
		operation: { type: "string" },
		repeat: { type: "string", default: "3" },
		"max-calls": { type: "string", default: "20" },
		"max-usd": { type: "string", default: "1" },
		limit: { type: "string" },
		output: { type: "string", default: ".maestro/artifacts/ai-evals" },
	},
});

class EvaluationConfigurationError extends Error {}

const positiveNumber = (value: string, integer = false) => {
	const parsed = Number(value);
	if (
		!Number.isFinite(parsed) ||
		parsed <= 0 ||
		(integer && !Number.isInteger(parsed))
	)
		throw new EvaluationConfigurationError("Limits must be positive numbers.");
	return parsed;
};
const requireEnv = (name: string) => {
	const value = process.env[name]?.trim();
	if (!value) throw new EvaluationConfigurationError(`Missing ${name}.`);
	return value;
};
const getModel = (config: ModelConfig) => {
	switch (config.provider) {
		case "openai":
			return createOpenAI({ apiKey: requireEnv("OPENAI_API_KEY") })(
				config.model,
			);
		case "anthropic":
			return createAnthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") })(
				config.model,
			);
		case "vertex": {
			const apiKey = process.env.GOOGLE_VERTEX_API_KEY?.trim();
			return createVertex(
				apiKey
					? { apiKey }
					: {
							project: requireEnv("GOOGLE_VERTEX_PROJECT"),
							location: config.region ?? "global",
						},
			)(config.model);
		}
	}
};

type CaseResult = {
	caseId: string;
	operation: EvaluationCase["operation"];
	sourceId: string;
	model: string;
	repetition: number;
	status: "success" | "failure" | "budget_exhausted";
	output?: unknown;
	errorCategory?: string;
	latencyMs: number;
	costUsd: number | null;
	usage?: LanguageModelUsage;
	scores: ReturnType<typeof scoreCase>;
	humanReviewRequired: boolean;
};
const percentile = (values: number[], quantile: number) => {
	if (values.length === 0) return null;
	const sorted = values.toSorted((a, b) => a - b);
	return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
};

async function main() {
	const corpusText = await readFile(values.corpus, "utf8");
	const corpus = corpusSchema.parse(JSON.parse(corpusText));
	const allCases = buildCases(corpus);
	if (!["development", "holdout", "all"].includes(values.split))
		throw new EvaluationConfigurationError("Unknown dataset split.");
	const candidates = z
		.array(modelConfigSchema)
		.min(1)
		.parse(JSON.parse(await readFile(values.config, "utf8")));
	if (
		new Set(candidates.map((candidate) => candidate.id)).size !==
		candidates.length
	)
		throw new EvaluationConfigurationError("Model config IDs must be unique.");
	const names = values.models.split(",");
	if (new Set(names).size !== names.length)
		throw new EvaluationConfigurationError(
			"Select each model configuration only once.",
		);
	const selected = names.map((name) => {
		const candidate = candidates.find((candidate) => candidate.id === name);
		if (!candidate)
			throw new EvaluationConfigurationError(
				`Unknown model configuration: ${name}`,
			);
		return candidate;
	});
	let cases = allCases.filter(
		(item) =>
			(values.split === "all" || item.split === values.split) &&
			(!values.operation || item.operation === values.operation),
	);
	if (values.limit) cases = cases.slice(0, positiveNumber(values.limit, true));
	if (cases.length === 0)
		throw new EvaluationConfigurationError("No evaluation cases selected.");
	const repetitions = positiveNumber(values.repeat, true);
	const maxCalls = positiveNumber(values["max-calls"], true);
	const maxUsd = positiveNumber(values["max-usd"]);
	const datasetVersion = createHash("sha256")
		.update(JSON.stringify(corpus))
		.update(JSON.stringify(allCases))
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
	const plannedCalls = cases.length * selected.length * repetitions;
	console.log(
		JSON.stringify(
			{
				mode: values.live ? "live" : "dry-run",
				datasetVersion,
				contractVersion,
				reviewStatus: corpus.reviewStatus,
				cases: cases.length,
				models: selected.map((candidate) => candidate.id),
				repetitions,
				plannedCalls,
				maxCalls,
				maxUsd,
			},
			null,
			2,
		),
	);
	if (!values.live) return;
	if (plannedCalls > maxCalls)
		throw new EvaluationConfigurationError(
			"Planned calls exceed --max-calls. Select a smaller slice or explicitly raise the limit.",
		);
	for (const candidate of selected) {
		if (
			!candidate.prices ||
			!candidate.pricingSource ||
			!candidate.pricingReviewedAt
		)
			throw new EvaluationConfigurationError(
				"Live model configurations require explicit prices, pricingSource, and pricingReviewedAt.",
			);
		getModel(candidate); // Validate configuration before making any paid calls.
	}
	if (values.publish) {
		if (process.env.LANGFUSE_TRACING_ENVIRONMENT !== "evaluation")
			throw new EvaluationConfigurationError(
				"Use a separate Langfuse evaluation environment/project.",
			);
		process.env.LANGFUSE_ENABLED = "true";
	}
	const flush = values.publish ? registerEvaluationTelemetry() : undefined;
	const client = values.publish ? new LangfuseClient() : undefined;
	let calls = 0;
	let spent = 0;
	let unknownSpend = false;
	const results: CaseResult[] = [];
	const runId = new Date().toISOString().replaceAll(":", "-");
	await mkdir(values.output, { recursive: true });
	const record = async (result: CaseResult) => {
		results.push(result);
		// Checkpoint after every request, including failures and budget skips.
		await writeFile(
			`${values.output}/${runId}.json`,
			JSON.stringify(
				{
					runId,
					datasetVersion,
					contractVersion,
					corpusReviewStatus: corpus.reviewStatus,
					split: values.split,
					completeSplit: !values.limit && !values.operation,
					repetitions,
					candidates: selected,
					maxCalls,
					maxUsd,
					spent,
					unknownSpend,
					results,
				},
				null,
				2,
			),
		);
	};
	try {
		for (const candidate of selected) {
			const runOne = async (
				item: EvaluationCase,
				repetition: number,
			): Promise<CaseResult> => {
				const base = {
					caseId: item.id,
					operation: item.operation,
					sourceId: item.sourceId,
					model: candidate.id,
					repetition,
					humanReviewRequired: true,
				};
				if (calls >= maxCalls || spent >= maxUsd || unknownSpend) {
					const result: CaseResult = {
						...base,
						status: "budget_exhausted",
						latencyMs: 0,
						costUsd: null,
						scores: [{ name: "request_success", value: 0 }],
					};
					await record(result);
					return result;
				}
				calls += 1;
				const contract = evaluationContract(item.operation);
				const started = performance.now();
				let generationLatencyMs = 0;
				let output: unknown;
				let usage: LanguageModelUsage | undefined;
				let category: string | undefined;
				try {
					const generated = await withAiOperation(
						{ operation: item.operation, parentContext: context.active() },
						async () => {
							const generationStart = performance.now();
							try {
								return await generateText({
									model: observeAiModel(
										getModel(candidate),
										item.operation,
										candidate.prices
											? { prices: candidate.prices, region: candidate.region }
											: undefined,
									),
									output: Output.object({ schema: contract.schema }),
									system: contract.system,
									prompt: item.prompt,
									temperature: candidate.temperature ?? contract.temperature,
									providerOptions: candidate.providerOptions,
									maxOutputTokens: contract.maxOutputTokens,
									maxRetries: 0,
									abortSignal: AbortSignal.timeout(60_000),
								});
							} finally {
								generationLatencyMs = performance.now() - generationStart;
							}
						},
					);
					usage = generated.usage;
					output = generated.output;
				} catch (error) {
					category = aiErrorCategory(error);
					if (NoObjectGeneratedError.isInstance(error)) usage = error.usage;
				}
				const costUsd = usage
					? (costForUsage(
							candidate.model,
							{
								input: usage.inputTokens,
								cachedInput: usage.inputTokenDetails.cacheReadTokens,
								cacheWrite: usage.inputTokenDetails.cacheWriteTokens,
								output: usage.outputTokens,
							},
							candidate.prices,
						) ?? null)
					: null;
				if (costUsd === null) unknownSpend = true;
				else spent += costUsd;
				const result: CaseResult = {
					...base,
					status: category ? "failure" : "success",
					errorCategory: category,
					output,
					usage,
					latencyMs: generationLatencyMs || performance.now() - started,
					costUsd,
					scores: [
						{ name: "request_success", value: Number(!category) },
						...scoreCase(item, output),
					],
				};
				await record(result);
				return result;
			};
			if (client) {
				await client.experiment.run<{
					item: EvaluationCase;
					repetition: number;
				}>({
					name: "dayova-learning-contracts",
					runName: `${runId}-${candidate.id}`,
					data: cases.flatMap((item) =>
						Array.from({ length: repetitions }, (_, repetition) => ({
							input: { item, repetition },
							expectedOutput: {
								rating: item.expectedRating,
								rubric: item.rubric,
							},
							metadata: {
								sourceId: item.sourceId,
								split: item.split,
								operation: item.operation,
							},
						})),
					),
					metadata: {
						datasetVersion,
						contractVersion,
						candidate,
						reviewStatus: corpus.reviewStatus,
					},
					maxConcurrency: 1,
					task: async ({ input }) => {
						const decoded = z
							.object({
								item: z.object({ id: z.string() }),
								repetition: z.number().int().nonnegative(),
							})
							.parse(input);
						const item = cases.find((item) => item.id === decoded.item.id);
						if (!item)
							throw new EvaluationConfigurationError(
								"Unknown experiment case.",
							);
						return await runOne(item, decoded.repetition);
					},
					evaluators: [async ({ output }) => (output as CaseResult).scores],
				});
			} else {
				for (const item of cases)
					for (let repetition = 0; repetition < repetitions; repetition += 1)
						await runOne(item, repetition);
			}
		}
	} finally {
		await flush?.();
	}
	const summaries = selected.flatMap((candidate) =>
		[...new Set(cases.map((item) => item.operation))].map((operation) => {
			const rows = results.filter(
				(row) => row.model === candidate.id && row.operation === operation,
			);
			return {
				model: candidate.id,
				operation,
				cases: rows.length,
				failures: rows.filter((row) => row.status !== "success").length,
				estimatedCostUsd: rows.reduce(
					(sum, row) => sum + (row.costUsd ?? 0),
					0,
				),
				unknownCosts: rows.filter((row) => row.costUsd === null).length,
				latencyP50Ms: percentile(
					rows
						.filter((row) => row.status !== "budget_exhausted")
						.map((row) => row.latencyMs),
					0.5,
				),
				latencyP95Ms: percentile(
					rows
						.filter((row) => row.status !== "budget_exhausted")
						.map((row) => row.latencyMs),
					0.95,
				),
				scores: aggregateScores(rows),
				humanReviewRequired: true,
			};
		}),
	);
	await writeFile(
		`${values.output}/${runId}-summary.json`,
		JSON.stringify(
			{ runId, datasetVersion, contractVersion, summaries },
			null,
			2,
		),
	);
	console.log(JSON.stringify(summaries, null, 2));
	if (results.some((row) => row.status !== "success")) process.exitCode = 1;
}

main().catch((error) => {
	console.error(
		error instanceof EvaluationConfigurationError
			? error.message
			: error instanceof z.ZodError
				? "Invalid evaluation corpus or configuration."
				: "Evaluation stopped; inspect the local report and configuration.",
	);
	process.exitCode = 1;
});
