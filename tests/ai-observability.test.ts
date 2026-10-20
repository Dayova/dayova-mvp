// @vitest-environment node
import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { APICallError, generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import {
	observeAiModel,
	setAiTraceSession,
	withAiOperation,
	withAiValidationAttempt,
} from "../ai/observability";
import { costForUsage } from "../ai/usage";

afterEach(() => vi.unstubAllEnvs());
const setup = () => {
	const exporter = new InMemorySpanExporter();
	const provider = new NodeTracerProvider({
		spanProcessors: [new SimpleSpanProcessor(exporter)],
	});
	return {
		exporter,
		runtime: {
			tracer: provider.getTracer("dayova-ai"),
			flush: () => provider.forceFlush(),
		},
	};
};
const response = () => ({
	content: [{ type: "text" as const, text: "SECRET GENERATED CONTENT" }],
	finishReason: { unified: "stop" as const, raw: "STOP" },
	usage: {
		inputTokens: {
			total: 100,
			noCache: 80,
			cacheRead: 20,
			cacheWrite: undefined,
		},
		outputTokens: { total: 40, text: 30, reasoning: 10 },
	},
	warnings: [],
});
const model = (doGenerate = async () => response()) =>
	new MockLanguageModelV3({
		provider: "google.vertex.chat",
		modelId: "gemini-3.5-flash-lite",
		doGenerate,
	});

test("traces usage and cost without capturing any prompt, output, or raw identity", async () => {
	vi.stubEnv("LANGFUSE_USER_HASH_SECRET", "test-only-salt");
	const { exporter, runtime } = setup();
	const result = await withAiOperation(
		{ operation: "diagnostic", actorId: "SECRET EMAIL", entityId: "opaque-id" },
		() =>
			generateText({
				model: observeAiModel(model(), "diagnostic"),
				prompt: "SECRET PROMPT",
				maxRetries: 0,
			}),
		runtime,
	);
	expect(result.text).toBe("SECRET GENERATED CONTENT");
	const spans = exporter.getFinishedSpans();
	expect(spans).toHaveLength(2);
	expect(spans[0].parentSpanContext?.spanId).toBe(
		spans[1].spanContext().spanId,
	);
	expect(spans[0].attributes["langfuse.observation.cost_details"]).toBe(
		JSON.stringify({ total: 0.0001246 }),
	);
	expect(
		JSON.parse(
			spans[0].attributes["langfuse.observation.usage_details"] as string,
		),
	).toEqual({ input: 80, input_cached: 20, output: 30, output_reasoning: 10 });
	expect(
		JSON.stringify(
			spans.map((span) => ({
				attributes: span.attributes,
				events: span.events,
				status: span.status,
			})),
		),
	).not.toContain("SECRET");
	expect(spans[1].attributes["user.id"]).toMatch(/^[a-f0-9]{64}$/);
	expect(spans[0].attributes["user.id"]).toBe(spans[1].attributes["user.id"]);
});

test("propagates workflow attribution to every validation and generation observation", async () => {
	vi.stubEnv("LANGFUSE_USER_HASH_SECRET", "test-only-salt");
	vi.stubEnv("LANGFUSE_TRACING_ENVIRONMENT", "development");
	vi.stubEnv("LANGFUSE_RELEASE", "test-release");
	const { exporter, runtime } = setup();
	await withAiOperation(
		{
			operation: "ensureSessionContent",
			actorId: "SECRET identity",
			entityId: "plan-id",
		},
		async () => {
			setAiTraceSession("learning-plan:plan-id");
			await withAiValidationAttempt(0, () =>
				generateText({
					model: observeAiModel(model(), "plan"),
					prompt: "SECRET",
				}),
			);
		},
		runtime,
	);
	const spans = exporter.getFinishedSpans();
	expect(spans).toHaveLength(3);
	for (const span of spans) {
		expect(span.attributes["session.id"]).toBe("learning-plan:plan-id");
		expect(span.attributes["user.id"]).toBe(spans[2].attributes["user.id"]);
		expect(span.attributes["langfuse.environment"]).toBe("development");
		expect(span.attributes["langfuse.release"]).toBe("test-release");
		expect(span.attributes["langfuse.trace.tags"]).toContain(
			"ensureSessionContent",
		);
		expect(
			JSON.parse(span.attributes["langfuse.observation.metadata"] as string),
		).toMatchObject({
			workflow: "ensureSessionContent",
			workflowLabel: "Lernblock-Inhalte bereitstellen",
			workflowDescription: expect.stringContaining(
				"vorhandene Lernblock-Inhalte",
			),
			entityId: "plan-id",
			contentCapture: "disabled",
		});
	}
	expect(spans[2].name).toBe("ensureSessionContent");
	expect(
		JSON.parse(spans[2].attributes["langfuse.trace.metadata"] as string),
	).toMatchObject({
		workflowLabel: "Lernblock-Inhalte bereitstellen",
		workflowDescription: expect.stringContaining("tatsächliche KI-Aufrufe"),
	});
	expect(JSON.stringify(spans.map((span) => span.attributes))).not.toContain(
		"SECRET",
	);
});

test("actual SDK retries produce separate generations in one trace", async () => {
	const { exporter, runtime } = setup();
	const doGenerate = vi
		.fn()
		.mockRejectedValueOnce(
			new APICallError({
				message: "SECRET provider response",
				url: "https://secret.invalid",
				requestBodyValues: { prompt: "SECRET" },
				statusCode: 503,
				isRetryable: true,
			}),
		)
		.mockResolvedValue(response());
	await withAiOperation(
		{ operation: "plan" },
		() =>
			generateText({
				model: observeAiModel(model(doGenerate), "plan"),
				prompt: "SECRET",
				maxRetries: 1,
			}),
		runtime,
	);
	const spans = exporter.getFinishedSpans();
	expect(spans).toHaveLength(3);
	expect(new Set(spans.map((span) => span.spanContext().traceId)).size).toBe(1);
	expect(spans[0].attributes["langfuse.observation.status_message"]).toBe(
		"provider_error",
	);
	expect(
		spans[0].attributes["langfuse.observation.cost_details"],
	).toBeUndefined();
	expect(
		JSON.stringify(
			spans.map((span) => ({
				attributes: span.attributes,
				events: span.events,
			})),
		),
	).not.toContain("SECRET");
});

test("validation retries preserve nesting and aggregate attempt counters", async () => {
	const { exporter, runtime } = setup();
	await withAiOperation(
		{ operation: "session" },
		async () => {
			for (let attempt = 0; attempt < 2; attempt += 1) {
				try {
					await withAiValidationAttempt(attempt, async () => {
						await generateText({
							model: observeAiModel(model(), "session_theory"),
							prompt: "SECRET",
						});
						if (attempt === 0) throw new Error("SECRET invalid content");
					});
				} catch {
					/* The application's existing retry policy owns recovery. */
				}
			}
		},
		runtime,
	);
	const spans = exporter.getFinishedSpans();
	expect(spans).toHaveLength(5);
	expect(
		JSON.parse(spans[4].attributes["langfuse.observation.metadata"] as string),
	).toMatchObject({ providerAttempts: 2, validationFailures: 1 });
	expect(spans[0].parentSpanContext?.spanId).toBe(
		spans[1].spanContext().spanId,
	);
});

test("concurrent operations cannot inherit each other's trace", async () => {
	const { exporter, runtime } = setup();
	await Promise.all(
		["first", "second"].map((operation) =>
			withAiOperation(
				{ operation },
				async () => {
					setAiTraceSession(`learning-plan:${operation}`);
					await Promise.resolve();
					await generateText({
						model: observeAiModel(model(), "plan"),
						prompt: operation,
					});
				},
				runtime,
			),
		),
	);
	const spans = exporter.getFinishedSpans();
	expect(new Set(spans.map((span) => span.spanContext().traceId)).size).toBe(2);
	const roots = spans.filter((span) => !span.parentSpanContext);
	expect(roots).toHaveLength(2);
	for (const root of roots)
		expect(
			spans.filter(
				(span) => span.parentSpanContext?.spanId === root.spanContext().spanId,
			),
		).toHaveLength(1);
	for (const root of roots) {
		const related = spans.filter(
			(span) => span.spanContext().traceId === root.spanContext().traceId,
		);
		expect(
			related.every(
				(span) =>
					span.attributes["session.id"] === `learning-plan:${root.name}`,
			),
		).toBe(true);
	}
});

test("flush failure preserves the result and the original application error", async () => {
	const { runtime } = setup();
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const broken = {
		...runtime,
		flush: async () => {
			throw new Error("SECRET exporter credentials");
		},
	};
	await expect(
		withAiOperation({ operation: "plan" }, async () => "success", broken),
	).resolves.toBe("success");
	const original = new Error("original");
	await expect(
		withAiOperation(
			{ operation: "plan" },
			async () => {
				throw original;
			},
			broken,
		),
	).rejects.toBe(original);
	expect(JSON.stringify(warn.mock.calls)).not.toContain("SECRET");
	warn.mockRestore();
});

test("disabled telemetry calls the task exactly once without requiring credentials", async () => {
	vi.stubEnv("LANGFUSE_ENABLED", "false");
	const task = vi.fn(async () => 42);
	await expect(withAiOperation({ operation: "plan" }, task)).resolves.toBe(42);
	expect(task).toHaveBeenCalledTimes(1);
});

test("invalid session labels and absent hashing secrets do not expose identity", async () => {
	vi.stubEnv("LANGFUSE_USER_HASH_SECRET", "");
	const { exporter, runtime } = setup();
	await withAiOperation(
		{ operation: "plan", actorId: "SECRET raw identity" },
		async () => {
			setAiTraceSession("SECRET learner text");
			await generateText({
				model: observeAiModel(model(), "plan"),
				prompt: "SECRET",
			});
		},
		runtime,
	);
	for (const span of exporter.getFinishedSpans()) {
		expect(span.attributes["session.id"]).toBeUndefined();
		expect(span.attributes["user.id"]).toBeUndefined();
		expect(JSON.stringify(span.attributes)).not.toContain("SECRET");
	}
});

test("the real Langfuse processor exports metadata-only OTLP over HTTP", async () => {
	const bodies: string[] = [];
	const server = createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk) => chunks.push(chunk));
		request.on("end", () => {
			const bytes = Buffer.concat(chunks);
			bodies.push(
				(request.headers["content-encoding"] === "gzip"
					? gunzipSync(bytes)
					: bytes
				).toString("utf8"),
			);
			response.writeHead(200, { "content-type": "application/json" });
			response.end("{}");
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Server unavailable");
	vi.stubEnv("LANGFUSE_ENABLED", "true");
	vi.stubEnv("LANGFUSE_PUBLIC_KEY", "pk-test");
	vi.stubEnv("LANGFUSE_SECRET_KEY", "sk-test");
	vi.stubEnv("LANGFUSE_TRACING_ENVIRONMENT", "development");
	vi.stubEnv("LANGFUSE_USER_HASH_SECRET", "test-only-salt");
	vi.stubEnv("LANGFUSE_BASE_URL", `http://127.0.0.1:${address.port}`);
	try {
		await withAiOperation(
			{ operation: "ensureSessionContent", actorId: "SECRET identity" },
			() => {
				setAiTraceSession("learning-plan:otlp-test");
				return generateText({
					model: observeAiModel(model(), "plan"),
					prompt: "SECRET PROMPT",
					maxRetries: 0,
				});
			},
		);
		expect(bodies.length).toBeGreaterThan(0);
		expect(bodies.join("")).toContain("gemini-3.5-flash-lite");
		expect(bodies.join("")).not.toContain("SECRET");
		expect(bodies.join("")).toContain("langfuse.observation.cost_details");
		const payloadSchema = z.object({
			resourceSpans: z.array(
				z.object({
					scopeSpans: z.array(
						z.object({
							spans: z.array(
								z.object({
									attributes: z.array(
										z.object({
											key: z.string(),
											value: z
												.object({ stringValue: z.string().optional() })
												.passthrough(),
										}),
									),
								}),
							),
						}),
					),
				}),
			),
		});
		const exportedSpans = bodies.flatMap((body) =>
			payloadSchema
				.parse(JSON.parse(body))
				.resourceSpans.flatMap((resource) =>
					resource.scopeSpans.flatMap((scope) => scope.spans),
				),
		);
		expect(exportedSpans).toHaveLength(2);
		for (const span of exportedSpans) {
			const attributes = Object.fromEntries(
				span.attributes.map((attribute) => [
					attribute.key,
					attribute.value.stringValue,
				]),
			);
			expect(attributes["session.id"]).toBe("learning-plan:otlp-test");
			expect(attributes["user.id"]).toMatch(/^[a-f0-9]{64}$/);
			expect(attributes["langfuse.environment"]).toBe("development");
			expect(
				JSON.parse(attributes["langfuse.observation.metadata"] as string),
			).toMatchObject({
				workflow: "ensureSessionContent",
				workflowLabel: "Lernblock-Inhalte bereitstellen",
				workflowDescription: expect.stringContaining("tatsächliche KI-Aufrufe"),
			});
		}
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
});

test("pricing uses exact model IDs, cache discounts, and inclusive output totals", () => {
	expect(
		costForUsage(
			"future-model",
			{ input: 100, cachedInput: 20, cacheWrite: 10, output: 40 },
			{ input: 1, cachedInput: 0.1, cacheWrite: 1.25, output: 2 },
		),
	).toBeCloseTo(0.0001645);
	expect(
		costForUsage(
			"future-model",
			{ input: 100, cacheWrite: 10, output: 40 },
			{ input: 1, cachedInput: 0.1, output: 2 },
		),
	).toBeUndefined();
	expect(
		costForUsage("gemini-3.5-flash-lite", {
			input: 100,
			cachedInput: 20,
			output: 40,
			reasoning: 10,
		}),
	).toBeCloseTo(0.0001246);
	expect(
		costForUsage("future-flash-lite", { input: 100, output: 40 }),
	).toBeUndefined();
	expect(
		costForUsage("gemini-3.5-flash-lite", { input: undefined, output: 40 }),
	).toBeUndefined();
	expect(
		costForUsage("gemini-3.5-flash-lite", {
			input: 100,
			cachedInput: 200,
			output: 40,
		}),
	).toBeUndefined();
});
