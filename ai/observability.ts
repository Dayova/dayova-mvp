import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac } from "node:crypto";
import { LangfuseOtelSpanAttributes as LF } from "@langfuse/core";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import {
	type Context,
	ROOT_CONTEXT,
	type Span,
	SpanStatusCode,
	type Tracer,
	trace,
} from "@opentelemetry/api";
import { AlwaysOnSampler } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { APICallError, NoObjectGeneratedError, wrapLanguageModel } from "ai";
import { costForUsage, type TokenPrices, type TokenUsage } from "./usage";

export type AiOperation =
	| "diagnostic"
	| "plan"
	| "answer_evaluation"
	| "session_theory"
	| "session_practice"
	| "session_praxis"
	| "timetable";
export type AiTraceContext = {
	operation: string;
	entityId?: string;
	actorId?: string;
	parentContext?: Context;
};
type Runtime = {
	tracer: Tracer;
	flush: () => Promise<void>;
	register?: () => void;
};
type OperationContext = {
	runtime: Runtime;
	span: Span;
	stats: { attempts: number; validationFailures: number };
};
const operations = new AsyncLocalStorage<OperationContext>();
let runtime: Runtime | undefined;

const safeLabel = (value: string | undefined) =>
	value && /^[a-zA-Z0-9_.:/-]{1,160}$/.test(value) ? value : undefined;
const diagnostic = () =>
	console.warn(
		"[Dayova:aiObservability] Telemetry unavailable; application behavior preserved.",
	);
const safely = <T>(task: () => T): T | undefined => {
	try {
		return task();
	} catch {
		diagnostic();
		return undefined;
	}
};

// A private provider receives ONLY the attributes constructed below. It is never
// registered globally, so HTTP instrumentation and provider error bodies cannot
// accidentally export prompts, signed URLs, credentials, or learner content.
const getRuntime = (): Runtime | undefined => {
	if (process.env.LANGFUSE_ENABLED !== "true") return undefined;
	if (runtime) return runtime;
	try {
		const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
		const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
		const environment = safeLabel(process.env.LANGFUSE_TRACING_ENVIRONMENT);
		if (!publicKey || !secretKey || !environment) return undefined;
		const processor = new LangfuseSpanProcessor({
			publicKey,
			secretKey,
			environment,
			baseUrl:
				process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com",
			release: safeLabel(process.env.LANGFUSE_RELEASE),
			timeout: 2,
			mediaUploadEnabled: false,
			shouldExportSpan: ({ otelSpan }) =>
				otelSpan.instrumentationScope.name === "dayova-ai" ||
				(environment === "evaluation" &&
					otelSpan.instrumentationScope.name === "langfuse-sdk"),
		});
		const provider = new NodeTracerProvider({
			spanProcessors: [processor],
			sampler: new AlwaysOnSampler(),
			forceFlushTimeoutMillis: 2500,
		});
		runtime = {
			tracer: provider.getTracer("dayova-ai", "1"),
			flush: () => provider.forceFlush(),
			register: () => provider.register(),
		};
		return runtime;
	} catch {
		diagnostic();
		return undefined;
	}
};

export const aiErrorCategory = (error: unknown): string => {
	if (NoObjectGeneratedError.isInstance(error)) return "schema_validation";
	if (APICallError.isInstance(error))
		return error.statusCode === 429 ? "rate_limit" : "provider_error";
	if (
		error instanceof Error &&
		(error.name === "AbortError" || error.name === "TimeoutError")
	)
		return "timeout";
	return "operation_error";
};

const failSpan = (span: Span, category: string) => {
	safely(() => {
		span.setStatus({ code: SpanStatusCode.ERROR });
		span.setAttribute(LF.OBSERVATION_LEVEL, "ERROR");
		span.setAttribute(LF.OBSERVATION_STATUS_MESSAGE, category);
	});
};

const childSpan = (
	ctx: OperationContext,
	name: string,
	type: "span" | "generation",
) =>
	safely(() =>
		ctx.runtime.tracer.startSpan(
			name,
			{
				attributes: { [LF.OBSERVATION_TYPE]: type },
			},
			trace.setSpan(ROOT_CONTEXT, ctx.span),
		),
	);

export const withAiOperation = async <T>(
	context: AiTraceContext,
	task: () => Promise<T>,
	injectedRuntime?: Runtime,
): Promise<T> => {
	const activeRuntime = injectedRuntime ?? getRuntime();
	if (!activeRuntime) return await task();
	let span: Span;
	try {
		const operation = safeLabel(context.operation) ?? "ai-operation";
		span = activeRuntime.tracer.startSpan(
			operation,
			{
				attributes: {
					[LF.OBSERVATION_TYPE]: "span",
					[LF.TRACE_NAME]: operation,
					[LF.TRACE_PUBLIC]: false,
					[LF.TRACE_TAGS]: ["dayova", "metadata-only"],
					[LF.TRACE_METADATA]: JSON.stringify({
						operation,
						entityId: safeLabel(context.entityId),
						contentCapture: "disabled",
						instrumentationVersion: "1",
					}),
				},
			},
			context.parentContext ?? ROOT_CONTEXT,
		);
		const salt = process.env.LANGFUSE_USER_HASH_SECRET;
		if (context.actorId && salt)
			span.setAttribute(
				LF.TRACE_USER_ID,
				createHmac("sha256", salt).update(context.actorId).digest("hex"),
			);
	} catch {
		diagnostic();
		return await task();
	}
	const ctx: OperationContext = {
		runtime: activeRuntime,
		span,
		stats: { attempts: 0, validationFailures: 0 },
	};
	try {
		return await operations.run(ctx, task);
	} catch (error) {
		failSpan(span, aiErrorCategory(error));
		throw error;
	} finally {
		safely(() => {
			span.setAttribute(
				LF.OBSERVATION_METADATA,
				JSON.stringify({
					providerAttempts: ctx.stats.attempts,
					validationFailures: ctx.stats.validationFailures,
				}),
			);
			span.end();
		});
		try {
			await activeRuntime.flush();
		} catch {
			diagnostic();
		}
	}
};

export const withAiValidationAttempt = async <T>(
	attempt: number,
	task: () => Promise<T>,
): Promise<T> => {
	const ctx = operations.getStore();
	if (!ctx) return await task();
	const span = childSpan(ctx, "validation-attempt", "span");
	if (!span) return await task();
	safely(() =>
		span.setAttribute(
			LF.OBSERVATION_METADATA,
			JSON.stringify({ attempt: attempt + 1 }),
		),
	);
	try {
		return await operations.run({ ...ctx, span }, task);
	} catch (error) {
		ctx.stats.validationFailures += 1;
		failSpan(span, aiErrorCategory(error));
		throw error;
	} finally {
		safely(() => span.end());
	}
};

export const observeAiModel = (
	model: Parameters<typeof wrapLanguageModel>[0]["model"],
	operation: AiOperation,
	pricing?: { prices: TokenPrices; region?: string },
) =>
	wrapLanguageModel({
		model,
		middleware: {
			specificationVersion: "v3",
			wrapGenerate: async ({ doGenerate, params }) => {
				const ctx = operations.getStore();
				if (!ctx) return await doGenerate();
				const span = childSpan(ctx, operation, "generation");
				if (!span) return await doGenerate();
				ctx.stats.attempts += 1;
				safely(() => {
					const config = params.providerOptions?.google?.thinkingConfig;
					const thinking =
						config && typeof config === "object" && !Array.isArray(config)
							? config
							: {};
					span.setAttribute(LF.OBSERVATION_MODEL, model.modelId);
					span.setAttribute(
						LF.OBSERVATION_MODEL_PARAMETERS,
						JSON.stringify({
							temperature: params.temperature,
							maxOutputTokens: params.maxOutputTokens,
							thinkingBudget:
								typeof thinking.thinkingBudget === "number" &&
								Number.isFinite(thinking.thinkingBudget)
									? thinking.thinkingBudget
									: undefined,
							thinkingLevel:
								typeof thinking.thinkingLevel === "string" &&
								["minimal", "low", "medium", "high"].includes(
									thinking.thinkingLevel,
								)
									? thinking.thinkingLevel
									: undefined,
						}),
					);
					span.setAttribute(
						LF.VERSION,
						safeLabel(process.env.LANGFUSE_RELEASE) ?? "unversioned",
					);
				});
				const region =
					pricing?.region ??
					(model.provider.startsWith("google.vertex")
						? (process.env.GOOGLE_VERTEX_LOCATION ?? "global")
						: undefined);
				const metadata = {
					operation,
					provider: model.provider,
					attempt: ctx.stats.attempts,
					region: safeLabel(region),
					costStatus: "unknown",
					usageStatus: "unknown",
				};
				safely(() =>
					span.setAttribute(LF.OBSERVATION_METADATA, JSON.stringify(metadata)),
				);
				try {
					const result = await doGenerate();
					const usage: TokenUsage = {
						input: result.usage.inputTokens.total,
						cachedInput: result.usage.inputTokens.cacheRead,
						cacheWrite: result.usage.inputTokens.cacheWrite,
						output: result.usage.outputTokens.total,
						reasoning: result.usage.outputTokens.reasoning,
					};
					// Usage categories are disjoint: cached and reasoning tokens are
					// already included in the provider totals.
					safely(() => {
						span.setAttribute(
							LF.OBSERVATION_USAGE_DETAILS,
							JSON.stringify({
								input:
									usage.input === undefined
										? undefined
										: Math.max(
												0,
												usage.input -
													(usage.cachedInput ?? 0) -
													(usage.cacheWrite ?? 0),
											),
								input_cached: usage.cachedInput,
								input_cache_write: usage.cacheWrite,
								output:
									usage.output === undefined
										? undefined
										: Math.max(0, usage.output - (usage.reasoning ?? 0)),
								output_reasoning: usage.reasoning,
							}),
						);
						const cost = pricing
							? costForUsage(model.modelId, usage, pricing.prices)
							: model.provider.startsWith("google.vertex") &&
									region === "global"
								? costForUsage(model.modelId, usage)
								: undefined;
						span.setAttribute(
							LF.OBSERVATION_METADATA,
							JSON.stringify({
								...metadata,
								costStatus: cost === undefined ? "unknown" : "estimated",
								usageStatus:
									usage.input === undefined || usage.output === undefined
										? "partial"
										: "complete",
							}),
						);
						if (cost !== undefined)
							span.setAttribute(
								LF.OBSERVATION_COST_DETAILS,
								JSON.stringify({ total: cost }),
							);
					});
					return result;
				} catch (error) {
					failSpan(span, aiErrorCategory(error));
					throw error;
				} finally {
					safely(() => span.end());
				}
			},
		},
	});

// Used only by the standalone synthetic evaluation CLI. Production keeps its
// provider private and never installs a global OpenTelemetry provider.
export const registerEvaluationTelemetry = () => {
	if (process.env.LANGFUSE_TRACING_ENVIRONMENT !== "evaluation")
		throw new Error(
			"Evaluation publication requires the evaluation environment.",
		);
	const activeRuntime = getRuntime();
	if (!activeRuntime)
		throw new Error(
			"Configure the Langfuse evaluation project before publishing.",
		);
	activeRuntime.register?.();
	return activeRuntime.flush;
};
