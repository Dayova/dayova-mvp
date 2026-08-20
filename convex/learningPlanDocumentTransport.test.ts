/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const sourceTransport = vi.hoisted(() => ({
	readCount: 0,
	body: "Lineare Funktionen haben die Form f(x) = mx + b. Die Steigung m beschreibt die Änderung von y.",
}));
const modelTransport = vi.hoisted(() => ({
	requestCount: 0,
	fail: false,
	invalidGermanResponses: 0,
	taskResponseCount: 0,
}));

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();
	return {
		...actual,
		generateText: vi.fn(
			async (options: { system?: string; messages?: unknown }) => {
				modelTransport.requestCount += 1;
				if (modelTransport.fail) throw new Error("Instrumented model failure");
				const usage = {
					inputTokens: 20,
					outputTokens: 10,
					totalTokens: 30,
					inputTokenDetails: {
						noCacheTokens: 20,
						cacheReadTokens: 0,
						cacheWriteTokens: 0,
					},
					outputTokenDetails: {
						textTokens: 10,
						reasoningTokens: 0,
					},
				};
				if (options.system?.includes("strenger, praxisnaher Lernplaner")) {
					return {
						text: "",
						output: {
							sourceSummary:
								"Das Material erklärt lineare Funktionen und ihre wichtigsten Eigenschaften.",
							insight: {
								summary:
									"Der Wissenscheck wird den nächsten konkreten Lernschritt bestimmen.",
								strengths: [],
								gaps: [
									"Steigung und Achsenabschnitt müssen zunächst sicher geprüft werden.",
								],
							},
							sessions: [
								{
									phase: "practice" as const,
									title: "Wissenscheck",
									dayOffsetBeforeExam: 5,
									startTime: "17:00",
									durationMinutes: 20,
									goal: "Den aktuellen Wissensstand mit kurzen Aufgaben sichtbar machen.",
									tasks: [
										"Fünf kurze Aufgaben ohne Hilfsmittel beantworten.",
										"Unsichere Antworten für die nächste Übung markieren.",
									],
									expectedOutcome:
										"Der aktuelle Wissensstand ist für die weitere Planung erfasst.",
								},
								{
									phase: "practice" as const,
									title: "Funktionen üben",
									dayOffsetBeforeExam: 3,
									startTime: "17:00",
									durationMinutes: 20,
									goal: "Lineare Funktionen mit konkreten Aufgaben sicher anwenden.",
									tasks: [
										"Steigung und Achsenabschnitt aus Gleichungen bestimmen.",
										"Funktionswerte berechnen und die Ergebnisse kontrollieren.",
									],
									expectedOutcome:
										"Die zentralen Aufgabentypen können nachvollziehbar gelöst werden.",
								},
							],
						},
						usage,
					};
				}
				if (options.system?.includes("praxisnaher Lerncoach")) {
					const serializedMessages = JSON.stringify(options.messages ?? []);
					const requestedCounts = Array.from(
						serializedMessages.matchAll(/Erzeuge exakt (\d+) Inhalte/g),
						(match) => Number(match[1]),
					);
					const singleCount = /genau (\d+) neue Fragen/.exec(
						serializedMessages,
					);
					const itemCount =
						requestedCounts.reduce((total, count) => total + count, 0) ||
						Number(singleCount?.[1] ?? 3);
					const prompts = [
						"Bestimme die Steigung der Funktion f(x) = 2x + 3.",
						"Berechne den y-Achsenabschnitt von g(x) = -4x + 7.",
						"Prüfe rechnerisch, ob der Punkt P(2|7) auf f(x) = 2x + 3 liegt.",
						"Gib eine lineare Funktionsgleichung mit der Steigung drei an.",
						"Beschreibe, wie sich ein negatives m auf den Graphen auswirkt.",
						"Berechne den Funktionswert h(5) für h(x) = x - 6.",
						"Bestimme die Nullstelle der Funktion k(x) = 3x - 12.",
						"Leite die Funktionsgleichung durch die Punkte A(0|1) und B(2|5) her.",
						"Vergleiche die Steilheit von f(x) = 2x und g(x) = 5x.",
						"Ermittle die Gleichung aus einer Wertetabelle mit konstanten Differenzen.",
						"Finde und korrigiere den Vorzeichenfehler in der angegebenen Rechnung.",
						"Berechne den Schnittpunkt zweier linearer Graphen rechnerisch.",
						"Ordne einer Geraden die passende Gleichung anhand zweier Punkte zu.",
						"Erkläre den Einfluss von b auf die Lage des linearen Graphen.",
						"Prüfe, ob eine gegebene Wertetabelle eine lineare Zuordnung beschreibt.",
						"Formuliere zu einer Alltagssituation eine passende lineare Funktion.",
						"Berechne den fehlenden x-Wert für einen vorgegebenen Funktionswert.",
						"Begründe, warum parallele Geraden dieselbe Steigung besitzen.",
					];
					const invalidGerman = modelTransport.invalidGermanResponses > 0;
					if (invalidGerman) modelTransport.invalidGermanResponses -= 1;
					const promptOffset = modelTransport.taskResponseCount * itemCount;
					modelTransport.taskResponseCount += 1;
					return {
						text: "",
						output: {
							items: Array.from({ length: itemCount }, (_, index) => ({
								kind: "written" as const,
								title: `Aufgabe ${index + 1}`,
								prompt:
									invalidGerman && index === 0
										? "Überpr\u0004fe die Steigung der linearen Funktion vollständig."
										: (prompts[(promptOffset + index) % prompts.length] ??
											prompts[0]),
								explanation:
									"Die Lösung folgt aus der Form f(x) = mx + b und einer sorgfältigen Rechnung.",
								idealAnswer:
									"Die Rechnung und das Ergebnis sind fachlich korrekt.",
								keywords: ["Steigung", "Funktion"],
							})),
						},
						usage,
					};
				}
				const topics = [
					{
						id: "steigung",
						title: "Steigung",
						learningGoal:
							"Die Steigung einer linearen Funktion sicher bestimmen.",
						keywords: ["Steigung", "Änderung"],
						priority: "high" as const,
						requiredEvidenceDimensions: [
							"understanding" as const,
							"problemSolving" as const,
						],
					},
					{
						id: "achsenabschnitt",
						title: "Achsenabschnitt",
						learningGoal: "Den y-Achsenabschnitt aus einer Gleichung ablesen.",
						keywords: ["Achsenabschnitt", "Gleichung"],
						priority: "high" as const,
						requiredEvidenceDimensions: ["understanding" as const],
					},
					{
						id: "funktionswerte",
						title: "Funktionswerte",
						learningGoal: "Funktionswerte durch korrektes Einsetzen berechnen.",
						keywords: ["Einsetzen", "Funktionswert"],
						priority: "medium" as const,
						requiredEvidenceDimensions: ["problemSolving" as const],
					},
				];
				const questions = Array.from({ length: 5 }, (_, index) => ({
					topicId: topics[index % topics.length]?.id ?? "steigung",
					kind: "performance" as const,
					evidenceDimension:
						index % 2 === 0
							? ("understanding" as const)
							: ("problemSolving" as const),
					responseKind:
						index < 2 ? ("multipleChoice" as const) : ("shortText" as const),
					options: index < 2 ? ["1", "2", "3"] : [],
					correctOptionIndex: index < 2 ? 1 : null,
					prompt: `Welche Aussage ${index + 1} beschreibt die lineare Funktion korrekt?`,
					targetInsight: "Zeigt das Verständnis der linearen Funktion.",
					idealAnswer: "Die fachlich passende Aussage ist korrekt.",
					explanation: "Die Antwort folgt direkt aus der Funktionsgleichung.",
					evaluationKeywords: ["Funktion", `Antwort ${index + 1}`],
				}));
				return {
					text: "Lineare Funktionen haben eine Steigung und einen y-Achsenabschnitt.",
					output: {
						sourceSummary:
							"Das Material erklärt Steigung, Achsenabschnitt und Funktionswerte.",
						topics,
						questions,
					},
					usage,
				};
			},
		),
	};
});

vi.mock("./fileStorage", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./fileStorage")>();
	return {
		...actual,
		createManagedReadUrl: vi.fn(async () => "https://fixture.invalid/source"),
	};
});

const modules = import.meta.glob("./**/*.ts");
const user = { tokenIdentifier: "test:document-transport" };

beforeEach(() => {
	sourceTransport.readCount = 0;
	modelTransport.requestCount = 0;
	modelTransport.fail = false;
	modelTransport.invalidGermanResponses = 0;
	modelTransport.taskResponseCount = 0;
	vi.stubEnv("GOOGLE_VERTEX_API_KEY", "instrumented-test-key");
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			sourceTransport.readCount += 1;
			return new Response(sourceTransport.body, {
				status: 200,
				headers: { "Content-Type": "text/plain" },
			});
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

const createDocument = async (
	t: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
	args: { fileName: string; fileType: string },
) =>
	await t.run(async (ctx) => {
		const now = Date.now();
		const learningPlanId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: user.tokenIdentifier,
			subject: "Mathematik",
			examTypeLabel: "Klausur",
			examDateKey: "2026-09-10",
			examDateLabel: "10. September 2026",
			durationMinutes: 90,
			topicDescription: "Lineare Funktionen",
			status: "draft",
			createdAt: now,
			updatedAt: now,
		});
		const documentId = await ctx.db.insert("learningPlanDocuments", {
			ownerTokenIdentifier: user.tokenIdentifier,
			learningPlanId,
			storageId: "instrumented-source",
			storageProvider: "r2",
			fileName: args.fileName,
			fileType: args.fileType,
			fileSizeBytes: new TextEncoder().encode(sourceTransport.body).byteLength,
			sourceKind: "school",
			processingStatus: "queued",
			createdAt: now,
		});
		return { documentId, learningPlanId };
	});

test("diagnostic, plan, session, add-session, and retry flows reuse one production source read", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const { documentId, learningPlanId } = await createDocument(t, {
		fileName: "lineare-funktionen.txt",
		fileType: "text/plain",
	});

	await t.action(internal.learningPlanAi.processUploadedDocument, {
		documentId,
	});
	await t.action(api.learningPlanAi.retryDocumentProcessing, { documentId });
	await t.action(api.learningPlanAi.generateKnowledgeQuestions, {
		learningPlanId,
	});
	await t.action(api.learningPlanAi.generateKnowledgeQuestions, {
		learningPlanId,
	});
	await t.mutation(api.learningPlans.confirmScope, { learningPlanId });
	await t.mutation(api.learningPlans.setTargetStudyMinutes, {
		learningPlanId,
		targetStudyMinutes: 40,
	});
	await t.run(async (ctx) => {
		const now = Date.now();
		for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek += 1) {
			await ctx.db.insert("userLearningTimes", {
				ownerTokenIdentifier: user.tokenIdentifier,
				dayOfWeek,
				startTime: "16:00",
				endTime: "19:00",
				createdAt: now,
				updatedAt: now,
			});
		}
	});
	await expect(
		t.action(api.learningPlanAi.generatePlan, {
			learningPlanId,
			answers: [],
		}),
	).resolves.toMatchObject({ sessionCount: 2 });

	const ensuredSessionId = await t.mutation(api.learningPlans.addSession, {
		learningPlanId,
	});
	modelTransport.invalidGermanResponses = 1;
	await expect(
		t.action(api.learningPlanAi.ensureSessionContent, {
			sessionId: ensuredSessionId,
		}),
	).resolves.toMatchObject({ itemCount: expect.any(Number) });
	await expect(
		t.action(api.learningPlanAi.addSessionWithContent, { learningPlanId }),
	).resolves.toMatchObject({ itemCount: expect.any(Number) });

	const failedSessionId = await t.mutation(api.learningPlans.addSession, {
		learningPlanId,
	});
	await t.mutation(internal.learningPlans.setSessionContentGenerationStatus, {
		sessionId: failedSessionId,
		status: "failed",
		errorMessage: "Instrumented prior failure",
	});
	await t.mutation(internal.learningPlans.finalizeContentGeneration, {
		learningPlanId,
	});
	await expect(
		t.action(api.learningPlanAi.retryFailedSessionContent, {
			learningPlanId,
		}),
	).resolves.toMatchObject({
		attemptedSessionCount: 1,
		failedSessionCount: 0,
		isReady: true,
	});

	expect(sourceTransport.readCount).toBe(1);
	expect(modelTransport.requestCount).toBeGreaterThanOrEqual(7);
	const diagnostics = await t.query(
		api.learningPlanAiTransfers.getMyDiagnostics,
		{ environment: "unknown" },
	);
	const ingestionAttempts = diagnostics.filter(
		(attempt) => attempt.operation === "document_ingestion",
	);
	const generationAttempts = diagnostics.filter(
		(attempt) => attempt.operation === "diagnostic",
	);
	const planAttempt = diagnostics.find(
		(attempt) => attempt.operation === "plan",
	);
	const sessionAttempts = diagnostics.filter(
		(attempt) => attempt.operation === "session_content",
	);
	const retryAttempt = diagnostics.find(
		(attempt) => attempt.operation === "session_retry",
	);
	expect(ingestionAttempts).toEqual([
		expect.objectContaining({
			learningPlanId,
			operation: "document_ingestion",
			status: "succeeded",
			sourceFileReadCount: 1,
			rawFilePartCount: 0,
			modelRequestCount: 0,
		}),
	]);
	expect(generationAttempts).toHaveLength(2);
	for (const generationAttempt of generationAttempts) {
		expect(generationAttempt).toMatchObject({
			status: "succeeded",
			reusedDocumentCount: 1,
			sourceFileReadCount: 0,
			rawFilePartCount: 0,
			modelRequestCount: 1,
		});
	}
	expect(planAttempt).toMatchObject({
		status: "succeeded",
		reusedDocumentCount: 1,
		sourceFileReadCount: 0,
		rawFilePartCount: 0,
		modelRequestCount: 1,
	});
	expect(sessionAttempts).toHaveLength(2);
	for (const sessionAttempt of sessionAttempts) {
		expect(sessionAttempt).toMatchObject({
			status: "succeeded",
			reusedDocumentCount: 1,
			sourceFileReadCount: 0,
			rawFilePartCount: 0,
		});
	}
	expect(
		sessionAttempts.map((attempt) => attempt.structuredRetryCount).sort(),
	).toEqual([0, 1]);
	expect(
		sessionAttempts.map((attempt) => attempt.modelRequestCount).sort(),
	).toEqual([1, 2]);
	expect(retryAttempt).toMatchObject({
		status: "succeeded",
		reusedDocumentCount: 1,
		sourceFileReadCount: 0,
		rawFilePartCount: 0,
		modelRequestCount: expect.any(Number),
	});
	const persisted = await t.run(async (ctx) => ({
		contexts: await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
			.take(2),
		chunks: await ctx.db
			.query("learningPlanDocumentChunks")
			.withIndex("by_documentId_and_chunkIndex", (q) =>
				q.eq("documentId", documentId),
			)
			.take(20),
	}));
	expect(persisted.contexts).toEqual([
		expect.objectContaining({ status: "ready", processingVersion: 2 }),
	]);
	expect(persisted.chunks).toHaveLength(1);
});

test("the production vision path counts its source read, raw part, and model request", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const { documentId, learningPlanId } = await createDocument(t, {
		fileName: "lineare-funktionen.png",
		fileType: "image/png",
	});

	await t.action(internal.learningPlanAi.processUploadedDocument, {
		documentId,
	});

	expect(sourceTransport.readCount).toBe(1);
	expect(modelTransport.requestCount).toBe(1);
	expect(
		await t.query(api.learningPlanAiTransfers.getMyDiagnostics, {
			environment: "unknown",
		}),
	).toEqual([
		expect.objectContaining({
			learningPlanId,
			operation: "document_ingestion",
			status: "succeeded",
			sourceFileReadCount: 1,
			rawFilePartCount: 1,
			rawFilePartBytes: new TextEncoder().encode(sourceTransport.body)
				.byteLength,
			modelRequestCount: 1,
		}),
	]);
});

test("a failed vision request still records the bytes that left the source transport", async () => {
	modelTransport.fail = true;
	const t = convexTest(schema, modules).withIdentity(user);
	const { documentId, learningPlanId } = await createDocument(t, {
		fileName: "lineare-funktionen.png",
		fileType: "image/png",
	});

	await expect(
		t.action(internal.learningPlanAi.processUploadedDocument, { documentId }),
	).rejects.toThrow("Instrumented model failure");

	expect(sourceTransport.readCount).toBe(1);
	expect(modelTransport.requestCount).toBe(1);
	expect(
		await t.query(api.learningPlanAiTransfers.getMyDiagnostics, {
			environment: "unknown",
		}),
	).toEqual([
		expect.objectContaining({
			learningPlanId,
			operation: "document_ingestion",
			status: "failed",
			sourceBytes: new TextEncoder().encode(sourceTransport.body).byteLength,
			sourceFileReadCount: 1,
			rawFilePartCount: 1,
			rawFilePartBytes: new TextEncoder().encode(sourceTransport.body)
				.byteLength,
			modelRequestCount: 1,
		}),
	]);
});
