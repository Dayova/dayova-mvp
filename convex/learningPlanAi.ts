"use node";

import { createVertex } from "@ai-sdk/google-vertex";
import {
	generateText,
	type LanguageModelUsage,
	NoObjectGeneratedError,
	Output,
} from "ai";
import { v } from "convex/values";
import { parseOffice } from "officeparser";
import { z } from "zod";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, action } from "./_generated/server";
import { isUnknownWrittenAnswer } from "./answerEvaluation";
import { readBooleanEnv, readOptionalEnv, readRequiredEnv } from "./env";
import {
	getUserFacingBackendErrorMessage,
	logDiagnosticError,
	throwUserFacingError,
} from "./errors";
import { createManagedReadUrl, type StorageProvider } from "./fileStorage";
import {
	isInvalidGeneratedGermanTextError,
	normalizeGeneratedGermanText,
} from "./generatedGermanText";
import {
	createLearningContentPlan,
	type LearningContentBlock,
	type LearningQuestionAngle,
	type LearningQuestionBlueprint,
	type LearningTopic,
} from "./learningContentPlan";
import { estimateGeminiCostUsdMicros } from "./learningPlanAiCost";
import { MISSING_LEARNING_TIMES_HINT } from "./learningPlanPlanningHints";
import {
	getDefaultPreparationDepth,
	type PreparationDepth,
	recommendLearningPreparation,
	type TopicReadinessCounts,
} from "./learningPreparationPolicy";
import {
	getLearningSessionComposition,
	isLearningSessionCompositionEligible,
} from "./learningSessionComposition";
import {
	MAX_MULTIPLE_CHOICE_OPTION_CHARS,
	MAX_MULTIPLE_CHOICE_PROMPT_CHARS,
	MULTIPLE_CHOICE_OPTION_COUNT,
} from "./learningSessionContentConstraints";
import { alignSessionDurationReferences } from "./learningSessionDurationText";
import {
	compactLearningSessionTitle,
	formatLearningTimeFromMinutes,
	parseLearningTimeToMinutes,
} from "./learningSessionScheduleFormatting";
import {
	rebalanceLearningPhases,
	splitLargeTheorySessions,
} from "./learningSessionSegmentation";
import {
	focusLearningTopics,
	getSessionLearningTopics,
	MAX_LEARNING_TOPIC_COUNT,
	normalizeLearningTopics,
} from "./learningTopicMap";
import { areSemanticallyDuplicateQuestions } from "./questionNovelty";

const MAX_UPLOAD_FILE_BYTES = 7 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 90_000;
const MAX_PROMPT_CONTEXT_CHARS = 70_000;
const MAX_SESSION_TITLE_CHARS = 28;
const MAX_GENERATED_TEXT_ATTEMPTS = 3;
const FLASH_MODEL_ID =
	readOptionalEnv("GOOGLE_VERTEX_FLASH_MODEL") ?? "gemini-3-flash-preview";
const FLASH_LITE_MODEL_ID =
	readOptionalEnv("GOOGLE_VERTEX_FLASH_LITE_MODEL") ?? "gemini-3.1-flash-lite";
const ENABLE_FLASH_LITE = readBooleanEnv("GOOGLE_ENABLE_FLASH_LITE", false);
const CONTENT_GENERATION_CONCURRENCY = 3;
const CONTENT_GENERATION_BATCH_SIZE = 3;
const ECONOMY_CONTENT_GENERATION_BATCH_SIZE = 4;
const MONTHLY_ECONOMY_THRESHOLD_USD_MICROS = 2_500_000;
const MONTHLY_TARGET_CEILING_USD_MICROS = 3_500_000;
const PROJECTED_SESSION_COST_USD_MICROS = 12_000;
const MIN_LEARNING_SLOT_MINUTES = 10;
const MAX_LEARNING_SESSION_MINUTES = 30;
const MAX_GENERATED_SESSIONS = 40;
const MIN_TOPIC_MAP_COUNT = 3;
const PREFERRED_TOPIC_MAP_COUNT = 6;
const TOPIC_MAP_GENERATION_INSTRUCTION = `Erstelle zuerst eine möglichst vollständige Themenkarte mit ${MIN_TOPIC_MAP_COUNT} bis ${MAX_LEARNING_TOPIC_COUNT} klar getrennten, einzeln prüfbaren Fähigkeiten. Ziele auf mindestens ${PREFERRED_TOPIC_MAP_COUNT} Themen, wenn die internen Schulmaterialien genügend fachliche Substanz enthalten; erfinde oder dupliziere aber keine Themen, um diese Zahl zu erreichen. Zerlege breite Sammelthemen in konkrete Fähigkeiten, die der Schüler jeweils erklären und in einer Aufgabe anwenden oder lösen können muss. Nutze kurze stabile ASCII-IDs wie "steigung-berechnen". Das learningGoal beschreibt beobachtbar, was der Schüler zu diesem Thema verstehen und lösen oder anwenden können muss. requiredEvidenceDimensions enthält grundsätzlich understanding und problemSolving; ergänze independent, wenn das Material eine selbstständige prüfungsnahe Anwendung verlangt. Lass problemSolving nur bei nachweislich reinem Faktenwissen weg. Leite den wahrscheinlichen Prüfungsstoff ausschließlich aus dem Hinweis der Lehrkraft und den internen Schulmaterialien ab. Externe Lernhilfen definieren niemals den Prüfungsstoff. Priorisiere explizite Prüfungshinweise vor allgemeinen oder älteren Übungsinhalten.`;
const GERMAN_UI_TEXT_RULE =
	"All visible German UI text must use correct umlauts and ß, not ae/oe/ue/ss substitutions.";
const KNOWLEDGE_QUESTIONS_OUTPUT_DESCRIPTION = `${GERMAN_UI_TEXT_RULE} Return five to ten objectively assessable questions for the first-session knowledge check.`;
const GENERATED_PLAN_OUTPUT_DESCRIPTION = `${GERMAN_UI_TEXT_RULE} Return a realistic, calendar-ready German learning plan with concrete study sessions.`;
const BERLIN_TIME_ZONE = "Europe/Berlin";

const vertexProviderOptions = {
	google: {
		thinkingConfig: {
			thinkingBudget: 0,
		},
	},
} as const;

type AiUsageOperation =
	| "diagnostic"
	| "plan"
	| "answer_evaluation"
	| "session_theory"
	| "session_practice"
	| "session_praxis";

const recordAiUsage = async (
	ctx: ActionCtx,
	args: {
		learningPlanId: Id<"learningPlans">;
		sessionId?: Id<"learningPlanSessions">;
		operation: AiUsageOperation;
		modelId: string;
		usage: LanguageModelUsage;
	},
) => {
	const inputTokens = args.usage.inputTokens ?? 0;
	const cachedInputTokens = args.usage.inputTokenDetails.cacheReadTokens ?? 0;
	const outputTokens = args.usage.outputTokens ?? 0;
	try {
		await ctx.runMutation(internal.learningPlanAiUsage.record, {
			learningPlanId: args.learningPlanId,
			...(args.sessionId ? { sessionId: args.sessionId } : {}),
			operation: args.operation,
			modelId: args.modelId,
			inputTokens,
			cachedInputTokens,
			outputTokens,
			estimatedCostUsdMicros: estimateGeminiCostUsdMicros({
				modelId: args.modelId,
				inputTokens,
				cachedInputTokens,
				outputTokens,
			}),
		});
	} catch (error) {
		logDiagnosticError("learningPlanAi.usageTelemetry", error, {
			learningPlanId: args.learningPlanId,
			operation: args.operation,
			modelId: args.modelId,
		});
	}
};

const getMonthlyCostMode = async (
	ctx: ActionCtx,
	projectedSessionCount = 0,
) => {
	try {
		const now = new Date();
		const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
		const summary: { estimatedCostUsdMicros: number } = await ctx.runQuery(
			api.learningPlanAiUsage.getMyMonthlyCostSummary,
			{ monthStart },
		);
		const projectedCost =
			summary.estimatedCostUsdMicros +
			projectedSessionCount * PROJECTED_SESSION_COST_USD_MICROS;
		return {
			economyMode:
				summary.estimatedCostUsdMicros >=
					MONTHLY_ECONOMY_THRESHOLD_USD_MICROS ||
				projectedCost >= MONTHLY_TARGET_CEILING_USD_MICROS,
			estimatedCostUsdMicros: summary.estimatedCostUsdMicros,
		};
	} catch (error) {
		logDiagnosticError("learningPlanAi.costMode", error, {
			projectedSessionCount,
		});
		return { economyMode: false, estimatedCostUsdMicros: 0 };
	}
};

const plainTextExtensions = new Set([
	"txt",
	"md",
	"markdown",
	"csv",
	"json",
	"yaml",
	"yml",
]);

const vertexNativeMediaTypes = new Set([
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
]);

const vertexNativeExtensions = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

const extensionToMediaType: Record<string, string> = {
	pdf: "application/pdf",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};

const sessionPhaseSchema = z.enum(["theory", "practice", "rehearsal"]);
type GeneratedSessionPhase = z.infer<typeof sessionPhaseSchema>;

const atMostArray = <TItem extends z.ZodType>(
	itemSchema: TItem,
	maxItems: number,
) =>
	z.preprocess(
		(value) => (Array.isArray(value) ? value.slice(0, maxItems) : value),
		z.array(itemSchema).max(maxItems),
	);

const boundedArray = <TItem extends z.ZodType>(
	itemSchema: TItem,
	minItems: number,
	maxItems: number,
) =>
	z.preprocess(
		(value) => (Array.isArray(value) ? value.slice(0, maxItems) : value),
		z.array(itemSchema).min(minItems).max(maxItems),
	);

const exactArray = <TItem extends z.ZodType>(
	itemSchema: TItem,
	itemCount: number,
) =>
	z.preprocess(
		(value) => (Array.isArray(value) ? value.slice(0, itemCount) : value),
		z.array(itemSchema).length(itemCount),
	);

const germanTextSchema = (
	minLength: number,
	description: string,
	maxVisibleLength?: number,
) =>
	(maxVisibleLength
		? z.string().min(minLength).max(maxVisibleLength)
		: z.string().min(minLength)
	).describe(`${description} ${GERMAN_UI_TEXT_RULE}`);

type GeneratedGermanText = z.infer<ReturnType<typeof germanTextSchema>>;

const questionsSchema = z
	.object({
		sourceSummary: germanTextSchema(
			20,
			"Brief German summary of the uploaded learning material.",
		),
		topics: boundedArray(
			z.object({
				id: z
					.string()
					.min(3)
					.max(48)
					.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
				title: germanTextSchema(3, "Short German name of one exam topic."),
				learningGoal: germanTextSchema(
					12,
					"Observable German learning goal for this topic.",
				),
				keywords: boundedArray(
					germanTextSchema(2, "Short German keyword for this topic."),
					1,
					8,
				),
				priority: z.enum(["high", "medium", "low"]),
				requiredEvidenceDimensions: z
					.array(z.enum(["understanding", "problemSolving", "independent"]))
					.min(1)
					.max(3)
					.describe(
						"Evidence dimensions actually required by the exam material for this topic: understanding for explaining concepts, problemSolving for selecting and applying a method, independent for completing exam-like tasks without hints.",
					),
			}),
			MIN_TOPIC_MAP_COUNT,
			MAX_LEARNING_TOPIC_COUNT,
		),
		questions: boundedArray(
			z.object({
				topicId: z.string().min(3).max(48),
				kind: z.literal("performance"),
				evidenceDimension: z.enum([
					"understanding",
					"problemSolving",
					"independent",
				]),
				responseKind: z.enum(["multipleChoice", "shortText", "longText"]),
				options: atMostArray(
					germanTextSchema(
						1,
						"One concise German answer option. Only return options for multiple-choice questions.",
						100,
					),
					4,
				),
				correctOptionIndex: z.number().int().min(0).max(3).nullable(),
				prompt: germanTextSchema(
					12,
					"One short, direct German diagnostic question the student can answer without deciphering nested instructions. Ask one thing only and never reference files or uploads.",
					180,
				),
				targetInsight: germanTextSchema(
					8,
					"What this answer reveals about the student's strengths, gaps, or needed learning blocks.",
				),
				idealAnswer: germanTextSchema(
					1,
					"Concise German ideal answer used to evaluate the student's response.",
				),
				explanation: germanTextSchema(
					12,
					"Brief German feedback that explains why the ideal answer is correct.",
				),
				evaluationKeywords: boundedArray(
					germanTextSchema(
						1,
						"Short expected concept or result used to evaluate demonstrated knowledge.",
					),
					1,
					5,
				),
			}),
			5,
			10,
		),
	})
	.describe(KNOWLEDGE_QUESTIONS_OUTPUT_DESCRIPTION);

const generatedPlanSchema = z
	.object({
		sourceSummary: germanTextSchema(
			20,
			"Brief German summary of the material used for this plan.",
		),
		insight: z.object({
			summary: germanTextSchema(
				20,
				"German summary of the student's current readiness.",
			),
			strengths: atMostArray(
				germanTextSchema(
					1,
					"Specific topic or skill the student already handles well.",
				),
				4,
			),
			gaps: boundedArray(
				germanTextSchema(
					1,
					"Specific gap that should shape the generated study sessions.",
				),
				1,
				5,
			),
		}),
		sessions: boundedArray(
			z.object({
				phase: sessionPhaseSchema,
				title: germanTextSchema(
					3,
					`Short German UI label for this study session. Max ${MAX_SESSION_TITLE_CHARS} characters.`,
				),
				dayOffsetBeforeExam: z.number().int().min(0).max(120),
				startTime: z.string().regex(/^\d{2}:\d{2}$/),
				durationMinutes: z.number().int().min(15).max(180),
				goal: germanTextSchema(
					20,
					"Student-facing goal for this session, tied to the student's answers and exam topic.",
				),
				tasks: boundedArray(
					germanTextSchema(
						8,
						"Concrete task the student can complete during this study session.",
					),
					2,
					5,
				),
				expectedOutcome: germanTextSchema(
					12,
					"Observable result the student should have after finishing this session.",
				),
			}),
			1,
			5,
		),
	})
	.describe(GENERATED_PLAN_OUTPUT_DESCRIPTION);

const generatedTaskChoiceSchema = z.object({
	text: germanTextSchema(
		1,
		`Concise German answer option containing one concept and at most one distinguishing characteristic. Keep it within ${MAX_MULTIPLE_CHOICE_OPTION_CHARS} characters.`,
	),
	isCorrect: z.boolean(),
});

const writtenAnswerEvaluationSchema = z.object({
	rating: z.enum(["notCorrect", "partiallyCorrect", "correct"]),
	review: germanTextSchema(
		12,
		"A concise German review of the learner's answer. State what is correct and integrate the essential correction or correct result without adding a separate ideal-answer section.",
		700,
	),
});

const evaluatedAnswerAttemptValidator = v.object({
	id: v.id("learningSessionAnswerAttempts"),
	itemId: v.id("learningSessionContentItems"),
	sessionId: v.id("learningPlanSessions"),
	selectedChoiceId: v.optional(v.string()),
	answerText: v.optional(v.string()),
	transcript: v.optional(v.string()),
	rating: v.union(
		v.literal("notCorrect"),
		v.literal("partiallyCorrect"),
		v.literal("correct"),
	),
	feedback: v.string(),
	perfectAnswer: v.string(),
	timeSpentSeconds: v.optional(v.number()),
	createdAt: v.number(),
});

type EvaluatedAnswerAttempt = {
	id: Id<"learningSessionAnswerAttempts">;
	itemId: Id<"learningSessionContentItems">;
	sessionId: Id<"learningPlanSessions">;
	selectedChoiceId?: string;
	answerText?: string;
	transcript?: string;
	rating: "notCorrect" | "partiallyCorrect" | "correct";
	feedback: string;
	perfectAnswer: string;
	timeSpentSeconds?: number;
	createdAt: number;
};

const generatedTaskBaseSchema = {
	title: germanTextSchema(3, "Short German UI label for this task."),
	explanation: germanTextSchema(
		20,
		"German feedback explanation that teaches the key idea and common mistake.",
	),
	idealAnswer: germanTextSchema(
		1,
		"German ideal answer; concise numeric or technical answers are valid when the explanation contains the reasoning.",
	),
	keywords: atMostArray(
		germanTextSchema(
			1,
			"Short German evaluation keyword; numeric answers such as 6 are valid.",
		),
		8,
	),
};

const generatedTaskItemSchema = z.union([
	z.object({
		kind: z.literal("multipleChoice"),
		...generatedTaskBaseSchema,
		prompt: germanTextSchema(
			12,
			"One direct German multiple-choice question without irrelevant scenario details.",
			MAX_MULTIPLE_CHOICE_PROMPT_CHARS,
		),
		choices: z.array(generatedTaskChoiceSchema).min(2).max(4),
	}),
	z.object({
		kind: z.literal("written"),
		...generatedTaskBaseSchema,
		prompt: germanTextSchema(
			12,
			"Concrete German written task prompt the learner can answer directly.",
		),
	}),
]);

const generatedTheoryItemSchema = z.object({
	conceptTitle: germanTextSchema(
		3,
		"Short, precise German title for exactly one concept.",
	),
	question: germanTextSchema(
		12,
		"One short German curiosity question shown before the theory. The learner has not seen the explanation yet and must be able to answer with an intuitive first guess. Ask one thing only. Never demand a definition, complete list, comparison, or step-by-step solution. Avoid specialist wording when everyday language works.",
		140,
	),
	explanation: germanTextSchema(
		60,
		"Concise German teaching explanation in one or two connected sentences. Explain why the idea works, not only what the result is.",
		320,
	),
	keyPoints: boundedArray(
		germanTextSchema(
			12,
			"One specific German key point that adds information and is not merely a keyword or a copy of another section.",
			150,
		),
		1,
		2,
	),
	example: germanTextSchema(
		45,
		"A concrete worked German example with an input or situation, the decisive step, and the result. Never copy the short answer or memory cue.",
		300,
	),
	memoryCue: germanTextSchema(
		12,
		"One memorable German rule of thumb that helps recall the concept. It must not duplicate the example or a key point.",
		120,
	),
	commonMistake: germanTextSchema(
		24,
		"One concept-specific German mistake, including how the learner can notice or prevent it.",
		180,
	),
	keywords: atMostArray(
		germanTextSchema(
			1,
			"Short German evaluation keyword; numeric answers such as 6 are valid.",
		),
		8,
	),
});

const createSessionTasksSchema = (itemCount: number) =>
	z
		.object({
			items: exactArray(generatedTaskItemSchema, itemCount),
		})
		.describe(
			`${GERMAN_UI_TEXT_RULE} Return concrete guided-practice or praxis tasks for a learning session.`,
		);

const createTheoryTopicsSchema = (itemCount: number) =>
	z
		.object({
			items: exactArray(generatedTheoryItemSchema, itemCount),
		})
		.describe(
			`${GERMAN_UI_TEXT_RULE} Return self-contained, instructional theory pages for a learning session.`,
		);

type LearningPlanAiContext = {
	plan: {
		_id: Id<"learningPlans">;
		subject: string;
		examTypeLabel: string;
		examDateKey: string;
		examDateLabel: string;
		examTime?: string;
		durationMinutes: number;
		targetStudyMinutes?: number;
		preparationDepth?: PreparationDepth;
		sessionCompositionVariant?: "control" | "split";
		diagnosticPlacement?: "firstSession";
		topicDescription: string;
		teacherGuidance?: string;
		notes?: string;
		knowledgeQuestions?: Array<{
			id: string;
			prompt: string;
			targetInsight: string;
			topicId?: string;
			kind?: "performance" | "confidence";
			responseKind?: "multipleChoice" | "shortText" | "longText";
			options?: string[];
			correctAnswer?: string;
			idealAnswer?: string;
			explanation?: string;
			evidenceDimension?: "understanding" | "problemSolving" | "independent";
			evaluationKeywords?: string[];
		}>;
		topicMap?: Array<{
			id: string;
			title: string;
			learningGoal: string;
			keywords: string[];
			priority: "high" | "medium" | "low";
			requiredEvidenceDimensions?: Array<
				"understanding" | "problemSolving" | "independent"
			>;
		}>;
		topicReadiness?: Array<{
			topicId: string;
			status: "secure" | "developing" | "unknown";
		}>;
	};
	documents: Array<{
		storageId: string;
		storageProvider: StorageProvider;
		fileName: string;
		fileType: string;
		fileSizeBytes: number;
		sourceKind?: "school" | "external";
	}>;
	learningTimes: Array<{
		dayOfWeek: number;
		startTime: string;
		endTime: string;
	}>;
	occupiedEntries: Array<{
		dayKey: string;
		time?: string;
		durationMinutes?: number;
	}>;
	accessKey: string;
};

type LearningSessionContentAiContext = {
	plan: LearningPlanAiContext["plan"] & {
		sourceSummary?: string;
		insight?: {
			summary: string;
			strengths: string[];
			gaps: string[];
		};
	};
	session: {
		_id: Id<"learningPlanSessions">;
		learningPlanId: Id<"learningPlans">;
		phase: GeneratedSessionPhase;
		title: string;
		durationMinutes: number;
		completed?: boolean;
		compositionVariant?: "control" | "split";
		sessionPurpose?: "diagnostic" | "learning";
		goal: string;
		tasks: string[];
		expectedOutcome: string;
		targetTopicIds?: string[];
		targetEvidenceDimension?:
			| "understanding"
			| "problemSolving"
			| "independent";
		planningStatus?: "committed" | "provisional";
		sortOrder: number;
	};
	planSessions: Array<{
		phase: GeneratedSessionPhase;
		sessionPurpose?: "diagnostic" | "learning";
		title: string;
		goal: string;
		sortOrder: number;
		knowledgeValidationConfidence?: "unsure" | "somewhatSure" | "sure";
	}>;
	documents: LearningPlanAiContext["documents"];
	answers: Array<{ questionId: string; answer: string }>;
	learningTimes: LearningPlanAiContext["learningTimes"];
	priorTheoryCards: Array<{ front: string; back: string }>;
	priorSessionItems: Array<{ prompt: string; coverageKey?: string }>;
	priorSessionEvidence: Array<{
		sessionTitle: string;
		question: string;
		response: string;
		rating: "notCorrect" | "partiallyCorrect" | "correct";
		feedback: string;
		idealAnswer: string;
		topicId?: string;
		evidenceDimension?: "understanding" | "problemSolving" | "independent";
	}>;
	priorCoverageKeys: string[];
	existingItemCount: number;
	hasTheoryKnowledgeCheck: boolean;
	hasCompleteTheoryPracticePairs: boolean;
	needsLegacyContentReplacement: boolean;
	accessKey: string;
};

type ModelDocumentInput = {
	storageId: string;
	storageProvider: StorageProvider;
	fileName: string;
	fileType: string;
	fileSizeBytes: number;
	sourceKind?: "school" | "external";
};

const createVertexModel = () => {
	const apiKey = readOptionalEnv("GOOGLE_VERTEX_API_KEY");
	if (apiKey) {
		return createVertex({ apiKey });
	}

	const project = readRequiredEnv(
		"GOOGLE_VERTEX_PROJECT",
		"Konfiguriere GOOGLE_VERTEX_API_KEY oder GOOGLE_VERTEX_PROJECT + GOOGLE_VERTEX_LOCATION.",
	);

	return createVertex({
		project,
		location: readOptionalEnv("GOOGLE_VERTEX_LOCATION") ?? "global",
	});
};

const withStructuredOutputErrorHandling = async <TResult>(
	task: () => Promise<TResult>,
	fallbackMessage: string,
) => {
	try {
		return await task();
	} catch (error) {
		if (NoObjectGeneratedError.isInstance(error)) {
			logDiagnosticError("learningPlanAi.structuredOutput", error, {
				finishReason: error.finishReason,
				text: error.text?.slice(0, 500),
				cause: error.cause,
			});
			throwUserFacingError(fallbackMessage);
		}

		throw error;
	}
};

const generatedTextRetrySystemInstruction = (attempt: number) =>
	attempt === 0
		? ""
		: " Die vorherige Ausgabe war ungültig oder wiederholte bereits vorhandene Fragen. Erzeuge alle Fragen vollständig neu, ohne inhaltliche Duplikate und mit korrekten Unicode-Zeichen wie ä, ö, ü, Ä, Ö, Ü und ß.";

const theoryGenerationSystemInstruction = (attempt: number) =>
	`Du bist ein präziser Lerncoach für Schüler der 10. bis 12. Klasse in Deutschland. Erstelle eine zusammenhängende Mini-Lektion aus kurzen deutschen Theorie-Seiten. Jede Seite konzentriert sich auf die in der Planung genannte Seitenrolle und baut auf der vorherigen Seite auf. Alle Pflichtfelder des Schemas unterstützen diese Rolle, statt ein zweites Thema einzuführen. Wiederhole keine Erklärung, kein Beispiel und keinen Merksatz auf einer späteren Seite.

Die hochgeladenen Schulunterlagen und die gespeicherte Materialzusammenfassung sind die fachliche Quelle. Übernimm ihre Begriffe und Schwerpunktsetzung. Erfinde keine Gesetze, Grenzwerte, Formeln, Fachbegriffe oder angeblichen Prüfungsanforderungen, die dort nicht belegt sind. Falls für ein Beispiel Details fehlen, verwende ein einfaches, ausdrücklich illustratives Beispiel ohne neue Fachbehauptungen.

Die erste Leitfrage wird vor der Erklärung als lockerer Einstieg gezeigt. Sie muss ohne Vorwissen mit einer Vermutung beantwortbar sein, genau eine Sache fragen und darf keine Definition, vollständige Aufzählung, keinen Vergleich oder fertigen Lösungsweg verlangen. Spätere Leitfragen lenken jeweils auf den nächsten Gedanken der Mini-Lektion.

Schreibe klar und altersgerecht. Halte alle Felder knapp: eine bis zwei Erklärungssätze, ein bis zwei konkrete Kernpunkte, ein kurzes nachvollziehbares Beispiel, einen knappen Merksatz und einen spezifischen Fehlerhinweis. Die Bereiche dürfen sich nicht inhaltlich wiederholen. Verwende keine Meta-Anweisungen oder internen Labels. Halte Reihenfolge und Seitenrollen exakt ein und antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`;

class DuplicateGeneratedPromptError extends Error {}

const withGeneratedTextRetry = async <TResult>(
	task: (attempt: number) => Promise<TResult>,
	fallbackMessage: string,
) => {
	for (let attempt = 0; attempt < MAX_GENERATED_TEXT_ATTEMPTS; attempt += 1) {
		try {
			return await withStructuredOutputErrorHandling(
				() => task(attempt),
				fallbackMessage,
			);
		} catch (error) {
			const isDuplicatePrompt = error instanceof DuplicateGeneratedPromptError;
			if (
				(isInvalidGeneratedGermanTextError(error) || isDuplicatePrompt) &&
				attempt < MAX_GENERATED_TEXT_ATTEMPTS - 1
			) {
				continue;
			}

			if (isInvalidGeneratedGermanTextError(error)) {
				logDiagnosticError("learningPlanAi.generatedGermanText", error, {
					attempts: MAX_GENERATED_TEXT_ATTEMPTS,
				});
				throwUserFacingError(fallbackMessage);
			}
			if (isDuplicatePrompt) {
				logDiagnosticError("learningPlanAi.duplicateGeneratedPrompt", error, {
					attempts: MAX_GENERATED_TEXT_ATTEMPTS,
				});
				throwUserFacingError(fallbackMessage);
			}

			throw error;
		}
	}

	throwUserFacingError(fallbackMessage);
};

const runLlmGeneration = async <TResult>(
	task: (abortSignal: AbortSignal) => Promise<TResult>,
) => await task(new AbortController().signal);

const normalizeAiGeneratedGermanText = (value: GeneratedGermanText) =>
	normalizeGeneratedGermanText(value);

const compactText = (value: string, maxChars: number) => {
	const normalized = value
		.replace(/\r/g, "")
		.replace(/\t/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	if (normalized.length <= maxChars) return normalized;

	return `${normalized.slice(0, maxChars)}\n\n[Inhalt wurde gekürzt.]`;
};

const compactInlineText = (value: string, maxChars: number) => {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxChars) return normalized;

	const maximumContentLength = Math.max(1, maxChars - 1);
	const candidate = normalized.slice(0, maximumContentLength).trimEnd();
	const lastWordBoundary = candidate.lastIndexOf(" ");
	const minimumUsefulLength = Math.floor(maximumContentLength * 0.6);
	const content =
		lastWordBoundary >= minimumUsefulLength
			? candidate.slice(0, lastWordBoundary)
			: candidate;
	return `${content.trimEnd()}…`;
};

const normalizeTaskChoiceText = (value: GeneratedGermanText) =>
	compactInlineText(
		normalizeAiGeneratedGermanText(value),
		MAX_MULTIPLE_CHOICE_OPTION_CHARS,
	);

const fallbackTitleByPhase: Record<GeneratedSessionPhase, string> = {
	theory: "Theorie-Block",
	practice: "Übungsblock",
	rehearsal: "Praxis",
};

const fallbackContentByPhase: Record<
	GeneratedSessionPhase,
	{ goal: string; tasks: string[]; expectedOutcome: string }
> = {
	theory: {
		goal: "Wiederhole die wichtigsten Grundlagen, damit du die Aufgaben sicher bearbeiten kannst.",
		tasks: [
			"Lies deine Notizen zu den zentralen Begriffen.",
			"Erstelle kurze Beispiele zu den wichtigsten Regeln.",
		],
		expectedOutcome: "Du kannst die wichtigsten Grundlagen erklären.",
	},
	practice: {
		goal: "Übe typische Prüfungsaufgaben und kontrolliere deine Lösungswege.",
		tasks: [
			"Löse passende Übungsaufgaben unter Prüfungsbedingungen.",
			"Vergleiche deine Lösung mit den Regeln und korrigiere Fehler.",
		],
		expectedOutcome: "Du hast zentrale Aufgabentypen sicher geübt.",
	},
	rehearsal: {
		goal: "Bearbeite eine kurze Generalprobe wie in der Prüfung.",
		tasks: [
			"Löse einen kompakten Probetest am Stück.",
			"Markiere offene Fragen für die letzte Wiederholung.",
		],
		expectedOutcome: "Du weißt, welche Punkte vor der Prüfung noch offen sind.",
	},
};

const fileExtension = (fileName: string) => {
	const parts = fileName.toLowerCase().split(".");
	return parts.length > 1 ? (parts.at(-1) ?? "") : "";
};

const isVertexNativeCandidate = (fileType: string, fileName: string) => {
	const normalizedType = fileType.toLowerCase().split(";")[0]?.trim() ?? "";
	return (
		vertexNativeMediaTypes.has(normalizedType) ||
		vertexNativeExtensions.has(fileExtension(fileName))
	);
};

const resolveMediaType = (fileType: string, fileName: string) => {
	if (fileType && fileType !== "application/octet-stream") return fileType;

	return (
		extensionToMediaType[fileExtension(fileName)] ?? "application/octet-stream"
	);
};

const extractTextFromBytes = async (
	fileName: string,
	fileType: string,
	fileBuffer: Buffer,
) => {
	const extension = fileExtension(fileName);
	if (fileType.startsWith("text/") || plainTextExtensions.has(extension)) {
		return compactText(
			new TextDecoder("utf-8").decode(fileBuffer),
			MAX_EXTRACTED_TEXT_CHARS,
		);
	}

	const parsed = await parseOffice(fileBuffer, {
		newlineDelimiter: "\n",
		ignoreNotes: false,
	});
	return compactText(parsed.toText(), MAX_EXTRACTED_TEXT_CHARS);
};

const buildModelInputFromDocuments = async (
	ctx: Pick<ActionCtx, "runMutation">,
	documents: ModelDocumentInput[],
	accessKey: string,
) => {
	const fileParts: Array<{
		type: "file";
		data: Buffer;
		mediaType: string;
		filename: string;
	}> = [];
	const textSections: string[] = [];

	for (const document of documents) {
		if (document.fileSizeBytes > MAX_UPLOAD_FILE_BYTES) {
			throwUserFacingError(
				`Die Datei "${document.fileName}" ist zu groß für die KI-Verarbeitung.`,
			);
		}

		const downloadUrl = await createManagedReadUrl(
			ctx,
			{
				storageId: document.storageId,
				storageProvider: document.storageProvider,
			},
			accessKey,
			{
				fileName: document.fileName,
				userFacingMessage: `Die Datei "${document.fileName}" konnte nicht gelesen werden. Lade sie bitte erneut hoch.`,
			},
		);
		const response = await fetch(downloadUrl);
		if (!response.ok) {
			logDiagnosticError(
				"learningPlanAi.documentDownload",
				new Error(`Datei-Download fehlgeschlagen: ${document.fileName}`),
				{
					fileName: document.fileName,
					status: response.status,
					statusText: response.statusText,
					storageProvider: document.storageProvider,
				},
			);
			throwUserFacingError(
				`Die Datei "${document.fileName}" konnte nicht gelesen werden. Lade sie bitte erneut hoch.`,
			);
		}

		const arrayBuffer = await response.arrayBuffer();
		if (arrayBuffer.byteLength > MAX_UPLOAD_FILE_BYTES) {
			throwUserFacingError(
				`Die Datei "${document.fileName}" ist zu groß für die KI-Verarbeitung.`,
			);
		}

		const mediaType = resolveMediaType(document.fileType, document.fileName);
		const buffer = Buffer.from(arrayBuffer);

		try {
			const extractedText = await extractTextFromBytes(
				document.fileName,
				mediaType,
				buffer,
			);
			if (extractedText) {
				const sourceLabel =
					(document.sourceKind ?? "school") === "school"
						? "INTERNES SCHULMATERIAL"
						: "EXTERNE LERNHILFE";
				textSections.push(
					`[${sourceLabel}: ${document.fileName}]\n${extractedText}`,
				);
			}
		} catch {
			// Images and some PDFs are still useful as native model inputs.
		}

		if (isVertexNativeCandidate(mediaType, document.fileName)) {
			fileParts.push({
				type: "file",
				data: buffer,
				mediaType,
				filename: `${(document.sourceKind ?? "school") === "school" ? "INTERN" : "EXTERN"} - ${document.fileName}`,
			});
		}
	}

	return {
		fileParts,
		sourceContext: compactText(
			textSections.join("\n\n---\n\n"),
			MAX_PROMPT_CONTEXT_CHARS,
		),
	};
};

type PreparedModelDocuments = Awaited<
	ReturnType<typeof buildModelInputFromDocuments>
>;

const getAvailableDays = (examDateKey: string) => {
	const examTime = new Date(examDateKey).getTime();
	if (!Number.isFinite(examTime)) return 7;

	return Math.max(0, Math.ceil((examTime - Date.now()) / 86_400_000));
};

const formatDateLabel = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		timeZone: BERLIN_TIME_ZONE,
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);

const berlinDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: BERLIN_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

const getBerlinDateTime = (date: Date) => {
	const partsByType = Object.fromEntries(
		berlinDateTimeFormatter
			.formatToParts(date)
			.map((part) => [part.type, part.value]),
	) as Record<string, string | undefined>;
	const hour = Number(partsByType.hour ?? 0);
	const minute = Number(partsByType.minute ?? 0);

	return {
		dateKey: `${partsByType.year}-${partsByType.month}-${partsByType.day}`,
		minutes: hour * 60 + minute,
	};
};

type BerlinDateTime = ReturnType<typeof getBerlinDateTime>;

const isFutureLearningSlot = (
	dateKey: string,
	startMinutes: number,
	nowBerlin: BerlinDateTime,
) => {
	if (dateKey > nowBerlin.dateKey) return true;
	if (dateKey < nowBerlin.dateKey) return false;
	return startMinutes > nowBerlin.minutes;
};

const getBerlinDayOfWeek = (date: Date) => {
	const value = new Intl.DateTimeFormat("en-US", {
		timeZone: BERLIN_TIME_ZONE,
		weekday: "short",
	}).format(date);

	return (
		(
			{
				Mon: 1,
				Tue: 2,
				Wed: 3,
				Thu: 4,
				Fri: 5,
				Sat: 6,
				Sun: 7,
			} as Record<string, number>
		)[value] ?? 1
	);
};

const buildDateFromOffset = (
	examDateKey: string,
	dayOffsetBeforeExam: number,
) => {
	const date = new Date(examDateKey);
	if (Number.isNaN(date.getTime())) {
		return new Date();
	}
	date.setUTCDate(date.getUTCDate() - dayOffsetBeforeExam);
	return date;
};

type LearningTimeWindow = LearningPlanAiContext["learningTimes"][number];
type OccupiedEntry = LearningPlanAiContext["occupiedEntries"][number];

type LearningSlot = {
	date: Date;
	dateKey: string;
	startMinutes: number;
	endMinutes: number;
};

const getOccupiedIntervalsByDay = (occupiedEntries: OccupiedEntry[]) => {
	const intervalsByDay = new Map<
		string,
		Array<{ start: number; end: number }>
	>();

	for (const entry of occupiedEntries) {
		if (!entry.time || !entry.durationMinutes || entry.durationMinutes <= 0) {
			continue;
		}

		const start = parseLearningTimeToMinutes(entry.time);
		if (start === null) continue;

		const intervals = intervalsByDay.get(entry.dayKey) ?? [];
		intervals.push({ start, end: start + entry.durationMinutes });
		intervalsByDay.set(entry.dayKey, intervals);
	}

	return intervalsByDay;
};

const subtractOccupiedIntervals = (
	startMinutes: number,
	endMinutes: number,
	occupiedIntervals: Array<{ start: number; end: number }>,
) => {
	let freeIntervals = [{ start: startMinutes, end: endMinutes }];

	for (const occupied of occupiedIntervals) {
		freeIntervals = freeIntervals.flatMap((free) => {
			if (occupied.start >= free.end || occupied.end <= free.start) {
				return [free];
			}

			return [
				{ start: free.start, end: Math.max(free.start, occupied.start) },
				{ start: Math.min(free.end, occupied.end), end: free.end },
			].filter(
				(interval) =>
					interval.end - interval.start >= MIN_LEARNING_SLOT_MINUTES,
			);
		});
	}

	return freeIntervals;
};

const overlapsInterval = (
	first: { start: number; end: number },
	second: { start: number; end: number },
) => first.start < second.end && first.end > second.start;

const getMinutesReservedForLaterSlots = ({
	requestedMinutes,
	selectedSlotCount,
	slotIndex,
}: {
	requestedMinutes: number;
	selectedSlotCount: number;
	slotIndex: number;
}) => {
	const remainingSlotCount = selectedSlotCount - slotIndex - 1;
	if (selectedSlotCount !== 3) {
		return remainingSlotCount * MIN_LEARNING_SLOT_MINUTES;
	}

	if (requestedMinutes >= 40) {
		return [20, 10, 0][slotIndex] ?? 0;
	}
	if (requestedMinutes >= 25) {
		return [10, 5, 0][slotIndex] ?? 0;
	}
	return remainingSlotCount * MIN_LEARNING_SLOT_MINUTES;
};

const buildLearningSlots = (
	examDateKey: string,
	availableDays: number,
	learningTimes: LearningTimeWindow[],
	occupiedEntries: OccupiedEntry[],
	requestedMinutes: number,
	maxSessionMinutes = MAX_LEARNING_SESSION_MINUTES,
	minimumSessionCount = 1,
) => {
	const windowsByDay = new Map<number, LearningTimeWindow[]>();
	for (const learningTime of learningTimes) {
		const startMinutes = parseLearningTimeToMinutes(learningTime.startTime);
		const endMinutes = parseLearningTimeToMinutes(learningTime.endTime);
		if (
			startMinutes === null ||
			endMinutes === null ||
			endMinutes <= startMinutes
		) {
			continue;
		}

		const windows = windowsByDay.get(learningTime.dayOfWeek) ?? [];
		windows.push(learningTime);
		windowsByDay.set(learningTime.dayOfWeek, windows);
	}

	const occupiedIntervalsByDay = getOccupiedIntervalsByDay(occupiedEntries);
	const nowBerlin = getBerlinDateTime(new Date());
	const candidates: LearningSlot[] = [];
	for (let offset = availableDays; offset >= 1; offset -= 1) {
		const date = buildDateFromOffset(examDateKey, offset);
		const dateKey = formatDateKey(date);
		const windows = windowsByDay.get(getBerlinDayOfWeek(date)) ?? [];

		for (const window of windows) {
			const startMinutes = parseLearningTimeToMinutes(window.startTime);
			const endMinutes = parseLearningTimeToMinutes(window.endTime);
			if (
				startMinutes === null ||
				endMinutes === null ||
				endMinutes <= startMinutes
			) {
				continue;
			}

			for (const interval of subtractOccupiedIntervals(
				startMinutes,
				endMinutes,
				occupiedIntervalsByDay.get(dateKey) ?? [],
			)) {
				if (!isFutureLearningSlot(dateKey, interval.start, nowBerlin)) {
					continue;
				}
				if (maxSessionMinutes < MAX_LEARNING_SESSION_MINUTES) {
					let startMinutes = interval.start;
					if (minimumSessionCount > 1) {
						const allocatableMinutes = Math.min(
							requestedMinutes,
							interval.end - interval.start,
						);
						const chunkCount = Math.min(
							Math.floor(allocatableMinutes / MIN_LEARNING_SLOT_MINUTES),
							Math.max(
								minimumSessionCount,
								Math.ceil(allocatableMinutes / maxSessionMinutes),
							),
						);
						let remainingMinutes = allocatableMinutes;
						for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
							const minutesReservedForLater =
								(chunkCount - chunkIndex - 1) * MIN_LEARNING_SLOT_MINUTES;
							const capacityMinutes = Math.min(
								maxSessionMinutes,
								remainingMinutes - minutesReservedForLater,
								interval.end - startMinutes,
							);
							if (capacityMinutes < MIN_LEARNING_SLOT_MINUTES) break;
							candidates.push({
								date,
								dateKey,
								startMinutes,
								endMinutes: startMinutes + capacityMinutes,
							});
							startMinutes += capacityMinutes;
							remainingMinutes -= capacityMinutes;
						}
						continue;
					}
					while (interval.end - startMinutes >= MIN_LEARNING_SLOT_MINUTES) {
						const capacityMinutes = Math.min(
							maxSessionMinutes,
							interval.end - startMinutes,
						);
						candidates.push({
							date,
							dateKey,
							startMinutes,
							endMinutes: startMinutes + capacityMinutes,
						});
						startMinutes += capacityMinutes;
					}
					continue;
				}

				const capacityMinutes = Math.min(
					maxSessionMinutes,
					interval.end - interval.start,
				);
				if (capacityMinutes >= MIN_LEARNING_SLOT_MINUTES) {
					candidates.push({
						date,
						dateKey,
						startMinutes: interval.start,
						endMinutes: interval.start + capacityMinutes,
					});
				}
				break;
			}
		}
	}

	const sortedCandidates = candidates.sort(
		(left, right) =>
			left.dateKey.localeCompare(right.dateKey) ||
			left.startMinutes - right.startMinutes,
	);
	const minimumPhaseSessionCount =
		minimumSessionCount > 1
			? minimumSessionCount
			: requestedMinutes >= MIN_LEARNING_SLOT_MINUTES * 3
				? 3
				: 1;
	let selectedCapacityMinutes = 0;
	let selectedCount = 0;
	while (
		selectedCount < sortedCandidates.length &&
		selectedCount < MAX_GENERATED_SESSIONS &&
		(selectedCapacityMinutes < requestedMinutes ||
			selectedCount < minimumPhaseSessionCount)
	) {
		const candidate = sortedCandidates[selectedCount];
		if (!candidate) break;
		selectedCapacityMinutes += candidate.endMinutes - candidate.startMinutes;
		selectedCount += 1;
	}

	const selectedCandidates = sortedCandidates.slice(0, selectedCount);
	let remainingRequestedMinutes = requestedMinutes;
	return selectedCandidates
		.map((candidate, index): LearningSlot | null => {
			const minutesReservedForLater = getMinutesReservedForLaterSlots({
				requestedMinutes,
				selectedSlotCount: selectedCandidates.length,
				slotIndex: index,
			});
			const durationMinutes = Math.min(
				candidate.endMinutes - candidate.startMinutes,
				maxSessionMinutes,
				Math.max(
					MIN_LEARNING_SLOT_MINUTES,
					remainingRequestedMinutes - minutesReservedForLater,
				),
			);
			if (
				durationMinutes < MIN_LEARNING_SLOT_MINUTES ||
				remainingRequestedMinutes < MIN_LEARNING_SLOT_MINUTES
			) {
				return null;
			}
			remainingRequestedMinutes -= durationMinutes;
			return {
				...candidate,
				endMinutes: candidate.startMinutes + durationMinutes,
			};
		})
		.filter((slot): slot is LearningSlot => slot !== null)
		.sort(
			(left, right) =>
				left.dateKey.localeCompare(right.dateKey) ||
				left.startMinutes - right.startMinutes,
		);
};

const hasOccupiedLearningTimeConflict = (
	learningTimes: LearningTimeWindow[],
	occupiedEntries: OccupiedEntry[],
) =>
	occupiedEntries.some((entry) => {
		if (!entry.time || !entry.durationMinutes || entry.durationMinutes <= 0) {
			return false;
		}
		const date = new Date(entry.dayKey);
		const entryStart = parseLearningTimeToMinutes(entry.time);
		if (Number.isNaN(date.getTime()) || entryStart === null) return false;
		const entryInterval = {
			start: entryStart,
			end: entryStart + entry.durationMinutes,
		};
		return learningTimes.some((learningTime) => {
			if (learningTime.dayOfWeek !== getBerlinDayOfWeek(date)) return false;
			const start = parseLearningTimeToMinutes(learningTime.startTime);
			const end = parseLearningTimeToMinutes(learningTime.endTime);
			return (
				start !== null &&
				end !== null &&
				overlapsInterval(entryInterval, { start, end })
			);
		});
	});

const getEmptyScheduleErrorMessage = (
	learningTimes: LearningTimeWindow[],
	occupiedEntries: OccupiedEntry[],
) => {
	if (learningTimes.length === 0) {
		return "Lege zuerst mindestens eine Lernzeit in den Einstellungen fest und versuche es erneut.";
	}
	if (hasOccupiedLearningTimeConflict(learningTimes, occupiedEntries)) {
		return "Bis zur Prüfung sind deine Lernzeiten bereits belegt. Verschiebe bestehende Lerntermine oder füge eine zusätzliche Lernzeit hinzu und versuche es erneut.";
	}
	return "Bis zur Prüfung ist keine freie Lernzeit von mindestens 10 Minuten verfügbar. Füge eine zusätzliche Lernzeit hinzu oder verschiebe den Prüfungstermin und versuche es erneut.";
};

const distributeSessionOffsets = (
	availableDays: number,
	sessions: z.infer<typeof generatedPlanSchema>["sessions"],
) => {
	const maxOffset = Math.max(availableDays, 0);
	if (maxOffset === 0) return sessions.map(() => 0);

	const usedOffsets = new Set<number>();
	return sessions.map((session, index) => {
		const fallbackOffset = Math.max(
			1,
			Math.round(((sessions.length - index) / sessions.length) * maxOffset),
		);
		const preferredOffset = Math.min(
			Math.max(session.dayOffsetBeforeExam || fallbackOffset, 1),
			maxOffset,
		);
		if (!usedOffsets.has(preferredOffset)) {
			usedOffsets.add(preferredOffset);
			return preferredOffset;
		}

		for (let distance = 1; distance <= maxOffset; distance += 1) {
			const earlierOffset = preferredOffset + distance;
			if (earlierOffset <= maxOffset && !usedOffsets.has(earlierOffset)) {
				usedOffsets.add(earlierOffset);
				return earlierOffset;
			}

			const laterOffset = preferredOffset - distance;
			if (laterOffset >= 1 && !usedOffsets.has(laterOffset)) {
				usedOffsets.add(laterOffset);
				return laterOffset;
			}
		}

		return preferredOffset;
	});
};

const buildRequiredPhaseSequence = (
	sessionCount: number,
): GeneratedSessionPhase[] | undefined => {
	if (sessionCount < 2) return undefined;

	if (sessionCount === 2) return ["theory", "practice"];

	return Array.from({ length: sessionCount }, (_, index) => {
		if (index === 0) return "theory";
		if (index === sessionCount - 1) return "rehearsal";
		return "practice";
	});
};

type AdaptivePreparationScheduling = {
	maxSessionMinutes: number;
	topicReadiness: TopicReadinessCounts;
	praxisSessionCount: number;
	minimumSessionCount?: number;
};

const buildAdaptivePhaseSequence = (
	sessionDurations: number[],
	preparation: AdaptivePreparationScheduling,
): GeneratedSessionPhase[] => {
	const sessionCount = sessionDurations.length;
	if (sessionCount <= 0) return [];
	const praxisEligibleIndexes = sessionDurations
		.map((duration, index) => ({ duration, index }))
		.filter(({ duration }) => duration >= 20)
		.map(({ index }) => index);
	const praxisSessionCount = Math.min(
		Math.max(1, preparation.praxisSessionCount),
		praxisEligibleIndexes.length,
	);
	const hasTheoryNeed =
		preparation.topicReadiness.unknown > 0 ||
		preparation.topicReadiness.developing > 0;
	const rehearsalIndexes = new Set<number>();
	for (let index = 0; index < praxisSessionCount; index += 1) {
		const position =
			praxisSessionCount === 1
				? praxisEligibleIndexes.length - 1
				: Math.round(
						((index + 1) * (praxisEligibleIndexes.length - 1)) /
							praxisSessionCount,
					);
		const sessionIndex = praxisEligibleIndexes[position];
		if (sessionIndex !== undefined) rehearsalIndexes.add(sessionIndex);
	}
	const learningIndexes = Array.from(
		{ length: sessionCount },
		(_, index) => index,
	).filter((index) => !rehearsalIndexes.has(index));
	const topicTheoryNeed =
		preparation.topicReadiness.unknown +
		Math.ceil(preparation.topicReadiness.developing / 2);
	const theorySlotCount = hasTheoryNeed
		? Math.min(
				Math.max(0, learningIndexes.length - 1),
				Math.max(1, Math.round(sessionCount * 0.22)),
				topicTheoryNeed,
			)
		: 0;
	const theoryIndexes = new Set<number>();
	let lastTheoryIndex = -2;
	for (let index = 0; index < theorySlotCount; index += 1) {
		const preferredPosition = Math.floor(
			(index * learningIndexes.length) / Math.max(theorySlotCount, 1),
		);
		const preferredIndex = learningIndexes[preferredPosition];
		const selectedIndex = learningIndexes.find(
			(candidate) =>
				candidate >= (preferredIndex ?? 0) && candidate > lastTheoryIndex + 1,
		);
		if (selectedIndex === undefined) break;
		theoryIndexes.add(selectedIndex);
		lastTheoryIndex = selectedIndex;
	}

	return Array.from({ length: sessionCount }, (_, index) => {
		if (rehearsalIndexes.has(index)) return "rehearsal";
		if (theoryIndexes.has(index)) return "theory";
		return "practice";
	});
};

const normalizeSessions = (
	examDateKey: string,
	availableDays: number,
	sessions: z.infer<typeof generatedPlanSchema>["sessions"],
	learningTimes: LearningTimeWindow[],
	occupiedEntries: OccupiedEntry[],
	confirmedTotalStudyMinutes?: number,
	topics: LearningTopic[] = [],
	adaptivePreparation?: AdaptivePreparationScheduling,
) => {
	const generatedMinutes = sessions.reduce(
		(total, session) => total + session.durationMinutes,
		0,
	);
	const requestedMinutes =
		confirmedTotalStudyMinutes !== undefined &&
		Number.isInteger(confirmedTotalStudyMinutes) &&
		confirmedTotalStudyMinutes >= MIN_LEARNING_SLOT_MINUTES
			? confirmedTotalStudyMinutes
			: generatedMinutes;
	const slots = buildLearningSlots(
		examDateKey,
		availableDays,
		learningTimes,
		occupiedEntries,
		requestedMinutes,
		adaptivePreparation?.maxSessionMinutes,
		adaptivePreparation?.minimumSessionCount,
	);
	const distributedOffsets = distributeSessionOffsets(availableDays, sessions);
	const prioritizedSessions = sessions
		.map((session, index) => ({
			session,
			preferredDateKey: formatDateKey(
				buildDateFromOffset(examDateKey, distributedOffsets[index] ?? 0),
			),
			remainingMinutes: session.durationMinutes,
		}))
		.sort((left, right) =>
			left.preferredDateKey.localeCompare(right.preferredDateKey),
		);

	const selectedSlots = slots.slice(0, MAX_GENERATED_SESSIONS);
	const requiredPhaseSequence = adaptivePreparation
		? buildAdaptivePhaseSequence(
				selectedSlots.map((slot) => slot.endMinutes - slot.startMinutes),
				adaptivePreparation,
			)
		: buildRequiredPhaseSequence(selectedSlots.length);
	const scheduledSessions = selectedSlots
		.map((slot, index) => {
			const durationMinutes = slot.endMinutes - slot.startMinutes;
			const sourceState =
				prioritizedSessions.find(
					(item) =>
						item.remainingMinutes > 0 && item.preferredDateKey <= slot.dateKey,
				) ??
				prioritizedSessions.find((item) => item.remainingMinutes > 0) ??
				prioritizedSessions[index % Math.max(prioritizedSessions.length, 1)];
			if (sourceState) {
				sourceState.remainingMinutes = Math.max(
					0,
					sourceState.remainingMinutes - durationMinutes,
				);
			}
			const source =
				sourceState?.session ?? sessions[index % Math.max(sessions.length, 1)];
			const sourcePhase = source?.phase ?? "practice";
			const phase = requiredPhaseSequence?.[index] ?? sourcePhase;
			const fallbackContent = fallbackContentByPhase[phase];
			const useFallbackContent = !source || phase !== sourcePhase;
			const alignAnyDuration = (value: string) =>
				alignSessionDurationReferences({ value, durationMinutes });
			const alignSourceDuration = (value: string) =>
				alignSessionDurationReferences({
					value,
					durationMinutes,
					sourceDurationMinutes: source?.durationMinutes ?? durationMinutes,
				});
			const title = useFallbackContent
				? fallbackTitleByPhase[phase]
				: alignAnyDuration(normalizeAiGeneratedGermanText(source.title));
			const tasks = useFallbackContent
				? fallbackContent.tasks
				: source.tasks
						.map((task) =>
							alignSourceDuration(normalizeAiGeneratedGermanText(task).trim()),
						)
						.filter(Boolean);
			return {
				phase,
				title:
					compactLearningSessionTitle(
						title || fallbackTitleByPhase[phase],
						MAX_SESSION_TITLE_CHARS,
					) || fallbackTitleByPhase[phase],
				dateKey: slot.date.toISOString(),
				dateLabel: formatDateLabel(slot.date),
				startTime: formatLearningTimeFromMinutes(slot.startMinutes),
				durationMinutes,
				goal:
					(useFallbackContent
						? fallbackContent.goal
						: alignAnyDuration(
								normalizeAiGeneratedGermanText(source.goal).trim(),
							)) || fallbackContent.goal,
				tasks: tasks.length > 0 ? tasks : fallbackContent.tasks,
				expectedOutcome:
					(useFallbackContent
						? fallbackContent.expectedOutcome
						: alignAnyDuration(
								normalizeAiGeneratedGermanText(source.expectedOutcome).trim(),
							)) || fallbackContent.expectedOutcome,
			};
		})
		.sort((left, right) => left.dateKey.localeCompare(right.dateKey));

	const phaseFallbacks = {
		theory: {
			title: fallbackTitleByPhase.theory,
			...fallbackContentByPhase.theory,
		},
		practice: {
			title: fallbackTitleByPhase.practice,
			...fallbackContentByPhase.practice,
		},
		rehearsal: {
			title: fallbackTitleByPhase.rehearsal,
			...fallbackContentByPhase.rehearsal,
		},
	};
	const phaseBalancedSessions = rebalanceLearningPhases({
		sessions: scheduledSessions,
		phaseFallbacks,
	});
	const normalizedSessions = splitLargeTheorySessions({
		sessions: phaseBalancedSessions,
		topics,
		maxSessions: MAX_GENERATED_SESSIONS,
		maxTitleChars: MAX_SESSION_TITLE_CHARS,
	}).sort(
		(left, right) =>
			left.dateKey.localeCompare(right.dateKey) ||
			left.startTime.localeCompare(right.startTime),
	);
	const plannedMinutes = normalizedSessions.reduce(
		(total, session) => total + session.durationMinutes,
		0,
	);
	const hasBusyLearningTimes = hasOccupiedLearningTimeConflict(
		learningTimes,
		occupiedEntries,
	);
	const availabilityHint =
		learningTimes.length === 0
			? MISSING_LEARNING_TIMES_HINT
			: hasBusyLearningTimes
				? "Belegte Zeiten ausgelassen."
				: undefined;
	const capacityHint =
		plannedMinutes < requestedMinutes
			? `${plannedMinutes}/${requestedMinutes} Min. geplant.`
			: undefined;
	const hints = [availabilityHint, capacityHint].filter(Boolean);

	return {
		sessions: normalizedSessions,
		planningHint: hints.length > 0 ? hints.join(" ") : undefined,
	};
};

export const __testOnlyLearningPlanAi = {
	normalizeSessions,
	getEmptyScheduleErrorMessage,
	generatedTaskChoiceSchema,
	generatedTaskItemSchema,
	normalizeTaskChoiceText,
	topicMapGenerationInstruction: TOPIC_MAP_GENERATION_INSTRUCTION,
};

const buildBaseContext = (
	context: Pick<LearningPlanAiContext, "plan" | "documents">,
) => {
	const { plan, documents } = context;
	return [
		`Fach: ${plan.subject}`,
		`Prüfungsart: ${plan.examTypeLabel}`,
		`Prüfungstermin: ${plan.examDateLabel}${plan.examTime ? `, ${plan.examTime}` : ""}`,
		`Bearbeitungszeit der Prüfung: ${plan.durationMinutes} Minuten`,
		plan.teacherGuidance
			? `Hinweis der Lehrkraft: ${plan.teacherGuidance}`
			: plan.topicDescription
				? `Bisherige Themenangabe: ${plan.topicDescription}`
				: "",
		plan.notes ? `Notizen: ${plan.notes}` : "",
		`Interne Schulmaterialien: ${documents.filter((document) => (document.sourceKind ?? "school") === "school").length}`,
		`Externe Lernhilfen: ${documents.filter((document) => document.sourceKind === "external").length}`,
	]
		.filter(Boolean)
		.join("\n");
};

const describeLearningTimes = (learningTimes: LearningTimeWindow[]) => {
	if (learningTimes.length === 0)
		return "Keine persönlichen Lernzeiten hinterlegt.";

	const dayLabels: Record<number, string> = {
		1: "Montag",
		2: "Dienstag",
		3: "Mittwoch",
		4: "Donnerstag",
		5: "Freitag",
		6: "Samstag",
		7: "Sonntag",
	};

	return learningTimes
		.slice()
		.sort(
			(left, right) =>
				left.dayOfWeek - right.dayOfWeek ||
				left.startTime.localeCompare(right.startTime) ||
				left.endTime.localeCompare(right.endTime),
		)
		.map(
			(time) =>
				`${dayLabels[time.dayOfWeek] ?? "Lerntag"} ${time.startTime}-${time.endTime}`,
		)
		.join("\n");
};

const getLearningContentTopics = (
	context: LearningSessionContentAiContext,
): LearningTopic[] => {
	if (context.plan.topicMap && context.plan.topicMap.length > 0) {
		const explicitlyTargetedTopics = context.session.targetTopicIds?.length
			? context.plan.topicMap.filter((topic) =>
					context.session.targetTopicIds?.includes(topic.id),
				)
			: [];
		if (explicitlyTargetedTopics.length > 0) {
			return explicitlyTargetedTopics;
		}
		const topics = getSessionLearningTopics({
			topics: context.plan.topicMap,
			strengths: context.plan.insight?.strengths ?? [],
			gaps: context.plan.insight?.gaps ?? [],
			sessionPhase: context.session.phase,
			sessionTitle: context.session.title,
			sessionGoal: context.session.goal,
		});
		if (context.session.phase !== "theory") return topics;
		const secureTopicIds = new Set(
			(context.plan.topicReadiness ?? [])
				.filter((topic) => topic.status === "secure")
				.map((topic) => topic.topicId),
		);
		const theoryTopics = topics.filter(
			(topic) => !secureTopicIds.has(topic.id),
		);
		return theoryTopics.length > 0 ? theoryTopics : topics;
	}

	const candidates = [
		context.plan.topicDescription,
		context.session.goal,
		...context.session.tasks,
		context.session.expectedOutcome,
		...(context.plan.insight?.gaps ?? []),
	];
	const seen = new Set<string>();
	return getSessionLearningTopics({
		topics: normalizeLearningTopics(
			candidates
				.map((value) => value.trim())
				.filter((value) => {
					const key = value.toLowerCase();
					if (!key || seen.has(key)) return false;
					seen.add(key);
					return true;
				})
				.slice(0, MAX_LEARNING_TOPIC_COUNT)
				.map((title, index) => ({
					title,
					learningGoal:
						context.session.tasks[
							index % Math.max(context.session.tasks.length, 1)
						] ?? context.session.goal,
					keywords: [context.plan.subject, title],
					priority: index < 3 ? ("high" as const) : ("medium" as const),
				})),
		),
		strengths: context.plan.insight?.strengths ?? [],
		gaps: context.plan.insight?.gaps ?? [],
		sessionPhase: context.session.phase,
		sessionTitle: context.session.title,
		sessionGoal: context.session.goal,
	});
};

const theoryPageRoleForAngle: Record<LearningQuestionAngle, string> = {
	recall:
		"Kernidee: Erkläre den zentralen Gedanken in Alltagssprache und warum er wichtig ist.",
	recognize:
		"Erkennen: Zeige, woran der Schüler den Gedanken in einer Aufgabe oder Situation erkennt und wovon er ihn abgrenzt.",
	apply:
		"Anwendung: Führe ein einziges konkretes Beispiel Schritt für Schritt vom Ausgangspunkt zum Ergebnis.",
	findError:
		"Fehlerkontrolle: Zeige einen typischen Denkfehler, wie man ihn bemerkt und wie man ihn korrigiert.",
	compare:
		"Einordnung: Stelle genau einen entscheidenden Unterschied oder Zusammenhang heraus.",
	examTransfer:
		"Prüfungstransfer: Zeige, wie der Gedanke in einer realistischen Prüfungsaufgabe genutzt wird.",
};

const formatQuestionBlueprints = (block: LearningContentBlock) =>
	block.questions
		.map(
			(question, index) =>
				`${index + 1}. Thema: ${question.topic.title}; Lernziel: ${question.topic.learningGoal}; ${block.phase === "theory" ? `Seitenrolle: ${theoryPageRoleForAngle[question.angle]}` : `Fragetyp: ${question.angle}`}; Antwortmodus: ${question.kind}; Zeitbudget: ${question.estimatedSeconds} Sekunden; Coverage-Key: ${question.coverageKey}`,
		)
		.join("\n");

const formatStoredKnowledgeAnswers = (
	questions: Array<{ id: string; prompt: string; targetInsight: string }> = [],
	answers: Array<{ questionId: string; answer: string }> = [],
) => {
	if (questions.length === 0)
		return "Keine Wissensanalyse-Antworten gespeichert.";

	const answersByQuestion = new Map(
		answers.map((answer) => [answer.questionId, answer.answer.trim()]),
	);

	return questions
		.map((question, index) => {
			const answer = answersByQuestion.get(question.id) || "Keine Antwort";
			return `${index + 1}. Frage: ${question.prompt}\nAntwort: ${answer}\nAnalyseziel: ${question.targetInsight}`;
		})
		.join("\n\n");
};

const formatPriorSessionEvidence = (
	evidence: LearningSessionContentAiContext["priorSessionEvidence"],
) => {
	if (evidence.length === 0) return "Noch keine Antworten aus Lernblöcken.";
	const compactEvidenceText = (value: string, maxLength = 500) =>
		value.length <= maxLength
			? value
			: `${value.slice(0, maxLength - 1).trimEnd()}…`;
	const ratingLabel = {
		correct: "richtig",
		partiallyCorrect: "teilweise richtig",
		notCorrect: "noch nicht richtig",
	} as const;
	return evidence
		.slice(0, 20)
		.map(
			(entry, index) =>
				`${index + 1}. Lernblock: ${compactEvidenceText(entry.sessionTitle, 100)}\nFrage: ${compactEvidenceText(entry.question)}\nAntwort des Schülers: ${compactEvidenceText(entry.response)}\nBewertung: ${ratingLabel[entry.rating]}\nRückmeldung: ${compactEvidenceText(entry.feedback)}\nIdeale Antwort: ${compactEvidenceText(entry.idealAnswer)}${entry.topicId ? `\nThema-ID: ${entry.topicId}` : ""}${entry.evidenceDimension ? `\nEvidenzdimension: ${entry.evidenceDimension}` : ""}`,
		)
		.join("\n\n");
};

const formatPlanSequence = (
	sessions: LearningSessionContentAiContext["planSessions"],
) =>
	sessions.length === 0
		? "Keine weiteren Sessions gespeichert."
		: sessions
				.map(
					(session) =>
						`${session.sortOrder + 1}. ${session.title} (${session.phase}): ${session.goal}`,
				)
				.join("\n");

const formatPriorTheoryCards = (
	cards: LearningSessionContentAiContext["priorTheoryCards"],
) =>
	cards.length === 0
		? "Noch keine vorherigen Theorie-Lernkarten gespeichert."
		: cards
				.map(
					(card, index) =>
						`${index + 1}. Vorderseite: ${card.front}\nRückseite: ${card.back}`,
				)
				.join("\n\n");

const keywordPattern = /[\p{L}\p{N}]+/gu;
const compactKeyword = (value: string) =>
	normalizeGeneratedGermanText(value)
		.toLowerCase()
		.match(keywordPattern)
		?.slice(0, 3)
		.join(" ") ?? "";

const normalizeTaskKeywords = (
	keywords: GeneratedGermanText[],
	prompt: string,
	idealAnswer: string,
) => {
	const normalizedKeywords = keywords
		.map((keyword) => compactKeyword(normalizeAiGeneratedGermanText(keyword)))
		.filter(Boolean);

	return normalizedKeywords.length > 0
		? normalizedKeywords
		: [compactKeyword(prompt), compactKeyword(idealAnswer)].filter(Boolean);
};

type GeneratedSessionContentInput = {
	phase: GeneratedSessionPhase;
	kind: "learnCard" | "multipleChoice" | "written";
	title: string;
	prompt: string;
	front?: string;
	back?: string;
	explanation: string;
	idealAnswer: string;
	theoryContent?: {
		conceptTitle: string;
		question: string;
		explanation: string;
		keyPoints: string[];
		example: string;
		memoryCue: string;
		commonMistake: string;
	};
	choices?: Array<{ id: string; text: string }>;
	correctChoiceId?: string;
	evaluationKeywords: string[];
	learningBlockIndex: number;
	topicId: string;
	questionAngle: string;
	coverageKey: string;
	estimatedSeconds: number;
};

const normalizeGeneratedTaskItems = (
	output: { items: Array<z.infer<typeof generatedTaskItemSchema>> },
	questions: LearningQuestionBlueprint[],
	block: LearningContentBlock,
): GeneratedSessionContentInput[] =>
	output.items.map((item, index) => {
		const blueprint = questions[index];
		if (!blueprint) {
			throw new Error("Generated task has no matching question blueprint.");
		}
		const title = normalizeAiGeneratedGermanText(item.title);
		const prompt = normalizeAiGeneratedGermanText(item.prompt);
		const explanation = normalizeAiGeneratedGermanText(item.explanation);
		const idealAnswer = normalizeAiGeneratedGermanText(item.idealAnswer);
		const evaluationKeywords = normalizeTaskKeywords(
			item.keywords,
			prompt,
			idealAnswer,
		);

		if (item.kind === "multipleChoice") {
			const generatedChoices = item.choices.map((choice, choiceIndex) => ({
				id: `choice-${choiceIndex + 1}`,
				text: normalizeTaskChoiceText(choice.text),
				isCorrect: choice.isCorrect,
			}));
			const correctGeneratedChoice =
				generatedChoices.find((choice) => choice.isCorrect) ??
				generatedChoices[0];
			const choices = [
				...(correctGeneratedChoice ? [correctGeneratedChoice] : []),
				...generatedChoices
					.filter((choice) => choice.id !== correctGeneratedChoice?.id)
					.slice(0, MULTIPLE_CHOICE_OPTION_COUNT - 1),
			];
			const correctChoice = choices.find((choice) => choice.isCorrect);

			return {
				kind: "multipleChoice" as const,
				title: title || `Aufgabe ${index + 1}`,
				prompt,
				explanation,
				idealAnswer,
				choices: choices.map(({ id, text }) => ({ id, text })),
				correctChoiceId: correctChoice?.id ?? choices[0]?.id ?? "choice-1",
				evaluationKeywords,
				phase: block.phase,
				learningBlockIndex: block.index,
				topicId: blueprint.topic.id,
				questionAngle: blueprint.angle,
				coverageKey: blueprint.coverageKey,
				estimatedSeconds: blueprint.estimatedSeconds,
			};
		}

		return {
			kind: item.kind,
			title: title || `Aufgabe ${index + 1}`,
			prompt,
			explanation,
			idealAnswer,
			evaluationKeywords,
			phase: block.phase,
			learningBlockIndex: block.index,
			topicId: blueprint.topic.id,
			questionAngle: blueprint.angle,
			coverageKey: blueprint.coverageKey,
			estimatedSeconds: blueprint.estimatedSeconds,
		};
	});

const normalizeGeneratedTheoryItems = (
	output: { items: Array<z.infer<typeof generatedTheoryItemSchema>> },
	questions: LearningQuestionBlueprint[],
	block: LearningContentBlock,
): GeneratedSessionContentInput[] =>
	output.items.map((generatedItem, index) => {
		const blueprint = questions[index];
		if (!blueprint) {
			throw new Error("Generated theory page has no matching blueprint.");
		}
		const conceptTitle = normalizeAiGeneratedGermanText(
			generatedItem.conceptTitle,
		);
		const question = normalizeAiGeneratedGermanText(generatedItem.question);
		const explanation = normalizeAiGeneratedGermanText(
			generatedItem.explanation,
		);
		const keyPoints = generatedItem.keyPoints.map((point) =>
			normalizeAiGeneratedGermanText(point),
		);
		const example = normalizeAiGeneratedGermanText(generatedItem.example);
		const memoryCue = normalizeAiGeneratedGermanText(generatedItem.memoryCue);
		const commonMistake = normalizeAiGeneratedGermanText(
			generatedItem.commonMistake,
		);
		const idealAnswer = keyPoints.join(" ");
		const evaluationKeywords = normalizeTaskKeywords(
			generatedItem.keywords,
			question,
			idealAnswer,
		);
		const distinctSections = new Set(
			[...keyPoints, example, memoryCue].map((section) =>
				section.trim().toLocaleLowerCase("de"),
			),
		);
		if (distinctSections.size !== keyPoints.length + 2) {
			throw new Error("Generated theory sections repeat the same content.");
		}

		return {
			phase: block.phase,
			kind: "learnCard" as const,
			title: conceptTitle,
			prompt: question,
			front: question,
			back: `${explanation} Beispiel: ${example} Merksatz: ${memoryCue}`,
			explanation,
			idealAnswer,
			theoryContent: {
				conceptTitle,
				question,
				explanation,
				keyPoints,
				example,
				memoryCue,
				commonMistake,
			},
			evaluationKeywords,
			learningBlockIndex: block.index,
			topicId: blueprint.topic.id,
			questionAngle: blueprint.angle,
			coverageKey: blueprint.coverageKey,
			estimatedSeconds: blueprint.estimatedSeconds,
		};
	});

const assertFreshGeneratedPrompts = (
	items: GeneratedSessionContentInput[],
	existingPrompts: string[],
) => {
	const seen = [...existingPrompts];
	for (const item of items) {
		if (
			/\bVariante\s+\d+\b/i.test(item.prompt) ||
			/Lösungsweg\s+zu\s*[„“"]/i.test(item.prompt)
		) {
			throw new Error(
				`Generated learning question contains a nested planning instruction: ${item.prompt}`,
			);
		}
		if (
			seen.some((prompt) =>
				areSemanticallyDuplicateQuestions(prompt, item.prompt),
			)
		) {
			throw new DuplicateGeneratedPromptError(
				`Generated duplicate or near-duplicate learning question: ${item.prompt}`,
			);
		}
		seen.push(item.prompt);
	}
};

const generateSessionContent = async (
	ctx: ActionCtx,
	sessionId: Id<"learningPlanSessions">,
	preparedDocuments?: PreparedModelDocuments,
	includePriorContent = true,
): Promise<{ itemCount: number }> => {
	const context: LearningSessionContentAiContext = await ctx.runQuery(
		internal.learningSessionContent.getSessionGenerationContext,
		{ sessionId, includePriorContent },
	);

	if (context.existingItemCount > 0 && !context.needsLegacyContentReplacement) {
		return { itemCount: context.existingItemCount };
	}

	const replaceExisting = context.needsLegacyContentReplacement;

	try {
		const composition = getLearningSessionComposition({
			phase: context.session.phase,
			durationMinutes: context.session.durationMinutes,
			variant: context.session.compositionVariant ?? "control",
		});
		const { fileParts, sourceContext } =
			preparedDocuments ??
			(await buildModelInputFromDocuments(
				ctx,
				context.documents,
				context.accessKey,
			));
		const model = createVertexModel();
		const personalLearningTimes = describeLearningTimes(context.learningTimes);
		const learningEvidence =
			context.priorSessionEvidence.length > 0
				? formatPriorSessionEvidence(context.priorSessionEvidence)
				: formatStoredKnowledgeAnswers(
						context.plan.knowledgeQuestions,
						context.answers,
					);
		const planSequence = formatPlanSequence(context.planSessions);
		const priorTheoryCards = formatPriorTheoryCards(context.priorTheoryCards);
		const userContent: Array<
			| { type: "text"; text: string }
			| { type: "file"; data: Buffer; mediaType: string; filename: string }
		> = [
			{
				type: "text",
				text: `${buildBaseContext(context)}
Zusammenfassung des Materials: ${context.plan.sourceSummary ?? "Keine Zusammenfassung gespeichert."}
Lernstands-Einschätzung: ${context.plan.insight?.summary ?? "Keine Einschätzung gespeichert."}
Offene Lücken: ${(context.plan.insight?.gaps ?? []).join("; ") || "Keine Lücken gespeichert."}

Lernevidenz aus abgeschlossenen Sessions:
${learningEvidence}

Behandle korrekt beantwortete Diagnosefragen als bereits beherrscht. Wiederhole weder deren Frage noch eine gleich schwere Variante. Nutze für beherrschte Themen anspruchsvollere Anwendungen, Fehleranalysen, Vergleiche oder Prüfungstransfers.

Lernplan-Reihenfolge:
${planSequence}

Vorherige Theorie-Lernkarten:
${priorTheoryCards}

Aktuelle Session:
Titel: ${context.session.title}
Phase: ${context.session.phase}
Lernzeit: ${context.session.durationMinutes} Minuten
Ziel: ${context.session.goal}
Evidenzziel: ${context.session.targetEvidenceDimension ?? "allgemeiner Lernfortschritt"}
Aufgaben im Lernslot:
${context.session.tasks.map((task) => `- ${task}`).join("\n")}
Erwartetes Ergebnis: ${context.session.expectedOutcome}

Persönliche Lernzeiten:
${personalLearningTimes}`,
			},
		];

		const contentPlan = createLearningContentPlan({
			segments: composition,
			topics: getLearningContentTopics(context),
			excludedCoverageKeys: context.priorCoverageKeys,
			questionIndexOffset: context.session.sortOrder * 100,
			maxBlockMinutes: 20,
		});
		const generatedItems: GeneratedSessionContentInput[] = [];
		const previouslyUsedPrompts = [
			...(context.plan.knowledgeQuestions ?? []).map(
				(question) => question.prompt,
			),
			...context.priorSessionItems.map((item) => item.prompt),
		];

		for (const block of contentPlan.blocks) {
			const blueprintText = formatQuestionBlueprints(block);
			const blockContent = [
				...userContent,
				{
					type: "text" as const,
					text: `Dieser Lernblock dauert ${block.durationMinutes} Minuten und enthält genau ${block.questions.length} ${block.phase === "theory" ? "fokussierte Seiten einer zusammenhängenden Mini-Lektion" : "neue Fragen"}. Halte dich in Reihenfolge und Themenbezug exakt an diese Planung:\n${blueprintText}`,
				},
				...(previouslyUsedPrompts.length > 0 || generatedItems.length > 0
					? [
							{
								type: "text" as const,
								text: `Diese Fragen wurden bereits in der Wissensanalyse, einer früheren Lernsession oder im aktuellen Lernblock verwendet und dürfen weder wörtlich noch inhaltlich wiederholt werden. Nur Zahlen, Namen oder Formulierungen auszutauschen zählt weiterhin als Wiederholung; ändere stattdessen Denkschritt, Anwendungssituation oder Darstellungsform:\n${[...previouslyUsedPrompts, ...generatedItems.map((item) => item.prompt)].map((prompt) => `- ${prompt}`).join("\n")}`,
							},
						]
					: []),
				...(sourceContext
					? [
							{
								type: "text" as const,
								text: `Auszüge aus dem Lernmaterial:\n${sourceContext}`,
							},
						]
					: []),
				...fileParts,
			];

			if (block.phase === "theory") {
				const blockSchema = createTheoryTopicsSchema(block.questions.length);
				const theoryModelId = ENABLE_FLASH_LITE
					? FLASH_LITE_MODEL_ID
					: FLASH_MODEL_ID;
				const generatedTopics = await withGeneratedTextRetry(
					async (attempt): Promise<GeneratedSessionContentInput[]> => {
						const result = await runLlmGeneration((abortSignal) =>
							generateText({
								model: model(theoryModelId),
								temperature: 0.2,
								maxOutputTokens: Math.min(
									6_000,
									800 + block.questions.length * 1_000,
								),
								abortSignal,
								providerOptions: vertexProviderOptions,
								output: Output.object({ schema: blockSchema }),
								system: theoryGenerationSystemInstruction(attempt),
								messages: [{ role: "user", content: blockContent }],
							}),
						);
						await recordAiUsage(ctx, {
							learningPlanId: context.session.learningPlanId,
							sessionId,
							operation: "session_theory",
							modelId: theoryModelId,
							usage: result.usage,
						});
						const normalizedItems = normalizeGeneratedTheoryItems(
							result.output,
							block.questions,
							block,
						);
						assertFreshGeneratedPrompts(normalizedItems, [
							...previouslyUsedPrompts,
							...generatedItems.map((item) => item.prompt),
						]);
						return normalizedItems;
					},
					"Die Theoriefragen konnten nicht zuverlässig erstellt werden. Versuche es erneut.",
				);
				generatedItems.push(...generatedTopics);
				continue;
			}

			const isPraxis = block.phase === "rehearsal";
			const needsComplexTaskModel = block.questions.some(
				(question) =>
					question.kind === "written" ||
					!["recall", "recognize"].includes(question.angle),
			);
			const taskModelId =
				ENABLE_FLASH_LITE && !isPraxis && !needsComplexTaskModel
					? FLASH_LITE_MODEL_ID
					: FLASH_MODEL_ID;
			const blockSchema = createSessionTasksSchema(block.questions.length);
			const generatedTasks = await withGeneratedTextRetry(
				async (attempt) => {
					const result = await runLlmGeneration((abortSignal) =>
						generateText({
							model: model(taskModelId),
							temperature: isPraxis ? 0.18 : 0.22,
							maxOutputTokens: Math.min(
								4_000,
								500 + block.questions.length * 550,
							),
							abortSignal,
							providerOptions: vertexProviderOptions,
							output: Output.object({ schema: blockSchema }),
							system: `Du bist ein praxisnaher Lerncoach. Erstelle natürliche, konkrete Aufgaben, die der Schüler ohne Entschlüsseln einer Meta-Anweisung direkt bearbeiten kann. Gib bei Rechen- oder Anwendungsaufgaben alle nötigen Werte und Bedingungen an. Frage pro Aufgabe genau eine Leistung ab. Zitiere keine andere Aufgabenformulierung, verwende keine internen Labels wie „Variante 1“ und schreibe nie Konstruktionen wie „Erkläre deinen Lösungsweg zu …“. Halte die vorgegebene Reihenfolge, Antwortmodi und individuellen Zeitbudgets ein. Antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`,
							messages: [{ role: "user", content: blockContent }],
						}),
					);
					await recordAiUsage(ctx, {
						learningPlanId: context.session.learningPlanId,
						sessionId,
						operation: isPraxis ? "session_praxis" : "session_practice",
						modelId: taskModelId,
						usage: result.usage,
					});
					const normalizedItems = normalizeGeneratedTaskItems(
						result.output,
						block.questions,
						block,
					);
					assertFreshGeneratedPrompts(normalizedItems, [
						...previouslyUsedPrompts,
						...generatedItems.map((item) => item.prompt),
					]);
					return normalizedItems;
				},
				`${isPraxis ? "Die Praxis-Fragen" : "Die Übungsfragen"} konnten nicht zuverlässig erstellt werden.`,
			);
			generatedItems.push(...generatedTasks);
		}

		return await ctx.runMutation(
			internal.learningSessionContent.storeGeneratedSessionContent,
			{
				sessionId,
				items: generatedItems,
				replaceExisting,
			},
		);
	} catch (error) {
		logDiagnosticError(
			"learningSessionContentAi.generateSessionContent",
			error,
			{
				sessionId,
				learningPlanId: context.session.learningPlanId,
			},
		);
		throw error;
	}
};

const buildSessionGenerationBatches = async (
	ctx: ActionCtx,
	sessionIds: Id<"learningPlanSessions">[],
	batchSize = CONTENT_GENERATION_BATCH_SIZE,
) => {
	const contexts: LearningSessionContentAiContext[] = await Promise.all(
		sessionIds.map((sessionId) =>
			ctx.runQuery(
				internal.learningSessionContent.getSessionGenerationContext,
				{
					sessionId,
					includePriorContent: false,
				},
			),
		),
	);
	const byPhase = new Map<
		GeneratedSessionPhase,
		LearningSessionContentAiContext[]
	>();
	for (const context of contexts) {
		if (
			context.existingItemCount > 0 &&
			!context.needsLegacyContentReplacement
		) {
			await ctx.runMutation(
				internal.learningPlans.setSessionContentGenerationStatus,
				{ sessionId: context.session._id, status: "ready" },
			);
			continue;
		}
		const phaseContexts = byPhase.get(context.session.phase) ?? [];
		phaseContexts.push(context);
		byPhase.set(context.session.phase, phaseContexts);
	}
	const batches: LearningSessionContentAiContext[][] = [];
	for (const phaseContexts of byPhase.values()) {
		for (let index = 0; index < phaseContexts.length; index += batchSize) {
			batches.push(phaseContexts.slice(index, index + batchSize));
		}
	}
	return batches;
};

const generateSessionContentBatch = async (
	ctx: ActionCtx,
	contexts: LearningSessionContentAiContext[],
	preparedDocuments: PreparedModelDocuments,
	economyMode = false,
) => {
	const firstContext = contexts[0];
	if (!firstContext) return [];
	const phase = firstContext.session.phase;
	if (contexts.some((context) => context.session.phase !== phase)) {
		throw new Error(
			"Only compatible session phases can be generated together.",
		);
	}

	const plannedSessions = contexts.map((context) => {
		if (
			context.existingItemCount > 0 &&
			!context.needsLegacyContentReplacement
		) {
			throw new Error("A generation batch contains existing session content.");
		}
		const composition = getLearningSessionComposition({
			phase: context.session.phase,
			durationMinutes: context.session.durationMinutes,
			variant: context.session.compositionVariant ?? "control",
		});
		const contentPlan = createLearningContentPlan({
			segments: composition,
			topics: getLearningContentTopics(context),
			excludedCoverageKeys: context.priorCoverageKeys,
			questionIndexOffset: context.session.sortOrder * 100,
			maxBlockMinutes: 20,
		});
		const block = contentPlan.blocks[0];
		if (contentPlan.blocks.length !== 1 || !block || block.phase !== phase) {
			throw new Error("This session composition cannot be batch generated.");
		}
		return { context, block };
	});
	const allQuestions = plannedSessions.flatMap(({ block }) => block.questions);
	const allPriorPrompts = Array.from(
		new Set(
			contexts.flatMap((context) => [
				...(context.plan.knowledgeQuestions ?? []).map(
					(question) => question.prompt,
				),
				...context.priorSessionItems.map((item) => item.prompt),
			]),
		),
	);
	const sessionInstructions = plannedSessions
		.map(
			({ context, block }, index) => `Session ${index + 1}:
Titel: ${context.session.title}
Phase: ${context.session.phase}
Lernzeit: ${context.session.durationMinutes} Minuten
Ziel: ${context.session.goal}
Evidenzziel: ${context.session.targetEvidenceDimension ?? "allgemeiner Lernfortschritt"}
Aufgaben: ${context.session.tasks.join("; ")}
Erwartetes Ergebnis: ${context.session.expectedOutcome}
Erzeuge exakt ${block.questions.length} Inhalte in dieser Reihenfolge:
${formatQuestionBlueprints(block)}`,
		)
		.join("\n\n");
	const userContent: Array<
		| { type: "text"; text: string }
		| { type: "file"; data: Buffer; mediaType: string; filename: string }
	> = [
		{
			type: "text",
			text: `${buildBaseContext(firstContext)}
Zusammenfassung des Materials: ${firstContext.plan.sourceSummary ?? "Keine Zusammenfassung gespeichert."}
Lernstands-Einschätzung: ${firstContext.plan.insight?.summary ?? "Keine Einschätzung gespeichert."}
Offene Lücken: ${(firstContext.plan.insight?.gaps ?? []).join("; ") || "Keine Lücken gespeichert."}

Lernevidenz aus abgeschlossenen Sessions:
${firstContext.priorSessionEvidence.length > 0 ? formatPriorSessionEvidence(firstContext.priorSessionEvidence) : formatStoredKnowledgeAnswers(firstContext.plan.knowledgeQuestions, firstContext.answers)}

Lernplan-Reihenfolge:
${formatPlanSequence(firstContext.planSessions)}

Auszüge aus dem Lernmaterial:
${preparedDocuments.sourceContext || "Keine Textauszüge verfügbar."}`,
		},
		...preparedDocuments.fileParts,
		{
			type: "text",
			text: `

Erstelle die Inhalte für die folgenden ${plannedSessions.length} kurzen Sessions in der angegebenen Session-Reihenfolge. Vermische keine Sessions. Die flache Ausgabeliste enthält zuerst alle Inhalte von Session 1, dann Session 2 und so weiter.

${sessionInstructions}

Bereits verwendete Fragen, die weder wörtlich noch inhaltlich wiederholt werden dürfen. Nur Zahlen, Namen oder Formulierungen auszutauschen zählt weiterhin als Wiederholung; neue Fragen brauchen einen anderen Denkschritt, eine andere Anwendungssituation oder Darstellungsform:
${allPriorPrompts.map((prompt) => `- ${prompt}`).join("\n") || "Keine."}`,
		},
	];
	const model = createVertexModel();
	const isTheory = phase === "theory";
	const isPraxis = phase === "rehearsal";
	const needsComplexTaskModel = allQuestions.some(
		(question) =>
			question.kind === "written" ||
			!["recall", "recognize"].includes(question.angle),
	);
	const modelId = isTheory
		? ENABLE_FLASH_LITE || economyMode
			? FLASH_LITE_MODEL_ID
			: FLASH_MODEL_ID
		: (ENABLE_FLASH_LITE && !isPraxis && !needsComplexTaskModel) ||
				(economyMode && !isPraxis)
			? FLASH_LITE_MODEL_ID
			: FLASH_MODEL_ID;
	const generatedItems = await withGeneratedTextRetry(async (attempt) => {
		const commonOptions = {
			model: model(modelId),
			temperature: isPraxis ? 0.18 : 0.2,
			maxOutputTokens: Math.min(
				economyMode ? 12_000 : 16_000,
				800 + allQuestions.length * (isTheory ? 900 : 520),
			),
			providerOptions: vertexProviderOptions,
			messages: [{ role: "user" as const, content: userContent }],
		};
		const result = isTheory
			? await runLlmGeneration((abortSignal) =>
					generateText({
						...commonOptions,
						abortSignal,
						output: Output.object({
							schema: createTheoryTopicsSchema(allQuestions.length),
						}),
						system: theoryGenerationSystemInstruction(attempt),
					}),
				)
			: await runLlmGeneration((abortSignal) =>
					generateText({
						...commonOptions,
						abortSignal,
						output: Output.object({
							schema: createSessionTasksSchema(allQuestions.length),
						}),
						system: `Du bist ein praxisnaher Lerncoach. Erstelle direkte, konkrete deutsche Aufgaben mit allen nötigen Werten und Bedingungen. Halte Reihenfolge, Antwortmodi und Zeitbudgets exakt ein und antworte ausschließlich im JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`,
					}),
				);
		await recordAiUsage(ctx, {
			learningPlanId: firstContext.session.learningPlanId,
			operation: isTheory
				? "session_theory"
				: isPraxis
					? "session_praxis"
					: "session_practice",
			modelId,
			usage: result.usage,
		});
		let itemOffset = 0;
		const normalizedBySession = plannedSessions.map(({ block }) => {
			const outputItems = result.output.items.slice(
				itemOffset,
				itemOffset + block.questions.length,
			);
			itemOffset += block.questions.length;
			return isTheory
				? normalizeGeneratedTheoryItems(
						{
							items: outputItems as unknown as Array<
								z.infer<typeof generatedTheoryItemSchema>
							>,
						},
						block.questions,
						block,
					)
				: normalizeGeneratedTaskItems(
						{
							items: outputItems as unknown as Array<
								z.infer<typeof generatedTaskItemSchema>
							>,
						},
						block.questions,
						block,
					);
		});
		assertFreshGeneratedPrompts(normalizedBySession.flat(), allPriorPrompts);
		return normalizedBySession;
	}, "Die Inhalte mehrerer Lernsessionen konnten nicht zuverlässig erstellt werden.");

	return await Promise.all(
		plannedSessions.map(async ({ context }, index) => {
			const items = generatedItems[index] ?? [];
			const result = await ctx.runMutation(
				internal.learningSessionContent.storeGeneratedSessionContent,
				{
					sessionId: context.session._id,
					items,
					replaceExisting: context.needsLegacyContentReplacement,
				},
			);
			return { sessionId: context.session._id, result, error: null };
		}),
	);
};

const generateTrackedSessionContentBatch = async (
	ctx: ActionCtx,
	contexts: LearningSessionContentAiContext[],
	preparedDocuments: PreparedModelDocuments,
	economyMode = false,
) => {
	await Promise.all(
		contexts.map((context) =>
			ctx.runMutation(
				internal.learningPlans.setSessionContentGenerationStatus,
				{
					sessionId: context.session._id,
					status: "generating",
				},
			),
		),
	);
	try {
		const results = await generateSessionContentBatch(
			ctx,
			contexts,
			preparedDocuments,
			economyMode,
		);
		await Promise.all(
			contexts.map((context) =>
				ctx.runMutation(
					internal.learningPlans.setSessionContentGenerationStatus,
					{ sessionId: context.session._id, status: "ready" },
				),
			),
		);
		return results;
	} catch (error) {
		return await Promise.all(
			contexts.map(async (context) => {
				const latest: LearningSessionContentAiContext = await ctx.runQuery(
					internal.learningSessionContent.getSessionGenerationContext,
					{ sessionId: context.session._id, includePriorContent: false },
				);
				const recovered =
					latest.existingItemCount > 0 && !latest.needsLegacyContentReplacement;
				await ctx.runMutation(
					internal.learningPlans.setSessionContentGenerationStatus,
					{
						sessionId: context.session._id,
						status: recovered ? "ready" : "failed",
						...(recovered
							? {}
							: {
									errorMessage:
										getUserFacingBackendErrorMessage(error) ?? undefined,
								}),
					},
				);
				if (recovered) {
					return {
						sessionId: context.session._id,
						result: { itemCount: latest.existingItemCount },
						error: null,
					};
				}
				return { sessionId: context.session._id, result: null, error };
			}),
		);
	}
};

const generateTrackedSessionContent = async (
	ctx: ActionCtx,
	sessionId: Id<"learningPlanSessions">,
	options: {
		preparedDocuments?: PreparedModelDocuments;
		includePriorContent?: boolean;
		generationStatusClaimed?: boolean;
	} = {},
) => {
	if (!options.generationStatusClaimed) {
		await ctx.runMutation(
			internal.learningPlans.setSessionContentGenerationStatus,
			{ sessionId, status: "generating" },
		);
	}
	try {
		const result = await generateSessionContent(
			ctx,
			sessionId,
			options.preparedDocuments,
			options.includePriorContent ?? true,
		);
		await ctx.runMutation(
			internal.learningPlans.setSessionContentGenerationStatus,
			{ sessionId, status: "ready" },
		);
		return { sessionId, result, error: null };
	} catch (error) {
		await ctx.runMutation(
			internal.learningPlans.setSessionContentGenerationStatus,
			{
				sessionId,
				status: "failed",
				errorMessage: getUserFacingBackendErrorMessage(error) ?? undefined,
			},
		);
		return { sessionId, result: null, error };
	}
};

const mapWithConcurrency = async <TItem, TResult>(
	items: TItem[],
	limit: number,
	task: (item: TItem) => Promise<TResult>,
) => {
	const results: TResult[] = new Array(items.length);
	let nextIndex = 0;
	const workerCount = Math.min(Math.max(1, limit), items.length);
	await Promise.all(
		Array.from({ length: workerCount }, async () => {
			while (nextIndex < items.length) {
				const index = nextIndex;
				nextIndex += 1;
				const item = items[index];
				if (item !== undefined) results[index] = await task(item);
			}
		}),
	);
	return results;
};

export const evaluateWrittenAnswer = action({
	args: {
		itemId: v.id("learningSessionContentItems"),
		answerText: v.string(),
		timeSpentSeconds: v.optional(v.number()),
	},
	returns: evaluatedAnswerAttemptValidator,
	handler: async (ctx, args): Promise<EvaluatedAnswerAttempt> => {
		const answerText = compactInlineText(args.answerText, 6_000);
		if (!answerText) throwUserFacingError("Antwort fehlt.");
		const context: {
			learningPlanId: Id<"learningPlans">;
			sessionId: Id<"learningPlanSessions">;
			subject: string;
			topicTitle: string | null;
			learningGoal: string | null;
			prompt: string;
			idealAnswer: string;
			explanation: string;
			evaluationKeywords: string[];
			evidenceDimension:
				| "understanding"
				| "problemSolving"
				| "independent"
				| null;
			questionAngle: string | null;
		} = await ctx.runQuery(
			internal.learningSessionContent.getWrittenAnswerEvaluationContext,
			{ itemId: args.itemId },
		);

		let evaluation: z.infer<typeof writtenAnswerEvaluationSchema>;
		if (isUnknownWrittenAnswer(answerText)) {
			evaluation = {
				rating: "notCorrect",
				review: `Du hast noch keine fachliche Antwort gegeben. Richtig ist: ${context.idealAnswer}`,
			};
		} else {
			try {
				const model = createVertexModel();
				const result = await withStructuredOutputErrorHandling(
					() =>
						runLlmGeneration((abortSignal) =>
							generateText({
								model: model(FLASH_MODEL_ID),
								temperature: 0.1,
								maxOutputTokens: 700,
								abortSignal,
								providerOptions: vertexProviderOptions,
								output: Output.object({
									schema: writtenAnswerEvaluationSchema,
								}),
								system: `Du bewertest schriftliche Antworten von Schülerinnen und Schülern fachlich präzise und fair. Bewerte Bedeutung, Lösungsweg und Vollständigkeit – niemals Wortanzahl, Schreibstil oder bloße Schlüsselworttreffer. "correct" gilt nur, wenn alle für die Frage wesentlichen Aussagen oder Rechenschritte stimmen. "partiallyCorrect" gilt bei einem fachlich brauchbaren Ansatz mit einer konkreten Lücke. "notCorrect" gilt bei einem falschen Ergebnis, einem grundlegenden Missverständnis oder fehlender fachlicher Substanz.

Die Rückmeldung besteht aus höchstens zwei kurzen deutschen Sätzen in direkter Du-Ansprache. Nenne konkret, welcher Teil der Antwort stimmt und welcher Teil fehlt oder falsch ist. Integriere das richtige Ergebnis oder die entscheidende fachliche Korrektur ausdrücklich in dieselbe Rückmeldung. Gib dafür nur die nötige Kernaussage der idealen Antwort wieder, nicht die vollständige Musterlösung. Die Rückmeldung muss allein verständlich sein und darf den Lernenden nicht auf eine separate ideale oder perfekte Antwort verweisen. Verwende keine Überschriften, keine Listen, keine Punktebewertung und keine allgemeinen Floskeln. Antworte ausschließlich im vorgegebenen JSON-Schema. ${GERMAN_UI_TEXT_RULE}`,
								prompt: `Fach: ${context.subject}
Thema: ${context.topicTitle ?? "Nicht näher benannt"}
Lernziel: ${context.learningGoal ?? "Nicht näher benannt"}
Evidenzdimension: ${context.evidenceDimension ?? "allgemein"}
Aufgabenart: ${context.questionAngle ?? "allgemein"}

Frage:
${context.prompt}

Antwort des Lernenden:
${answerText}

Ideale Antwort:
${context.idealAnswer}

Fachliche Erklärung:
${context.explanation}

Erwartete Kernbegriffe oder Ergebnisse (nur als Hilfsmittel, nicht als Worttreffer-Test):
${context.evaluationKeywords.join("; ") || "Keine zusätzlichen Kernbegriffe"}`,
							}),
						),
					"Die Antwort konnte nicht zuverlässig ausgewertet werden. Versuche es erneut.",
				);
				await recordAiUsage(ctx, {
					learningPlanId: context.learningPlanId,
					sessionId: context.sessionId,
					operation: "answer_evaluation",
					modelId: FLASH_MODEL_ID,
					usage: result.usage,
				});
				evaluation = {
					rating: result.output.rating,
					review: normalizeAiGeneratedGermanText(result.output.review),
				};
			} catch (error) {
				logDiagnosticError("learningPlanAi.evaluateWrittenAnswer", error, {
					learningPlanId: context.learningPlanId,
					sessionId: context.sessionId,
					itemId: args.itemId,
				});
				const message = getUserFacingBackendErrorMessage(error);
				throwUserFacingError(
					message ??
						"Die Antwort konnte nicht zuverlässig ausgewertet werden. Versuche es erneut.",
				);
			}
		}

		return await ctx.runMutation(
			internal.learningSessionContent.storeEvaluatedWrittenAnswer,
			{
				itemId: args.itemId,
				answerText,
				rating: evaluation.rating,
				feedback: evaluation.review,
				timeSpentSeconds: args.timeSpentSeconds,
			},
		);
	},
});

export const ensureSessionContent = action({
	args: {
		sessionId: v.id("learningPlanSessions"),
	},
	handler: async (ctx, args): Promise<{ itemCount: number }> => {
		const context: LearningSessionContentAiContext = await ctx.runQuery(
			internal.learningSessionContent.getSessionGenerationContext,
			{ sessionId: args.sessionId },
		);
		if (context.session.planningStatus === "provisional") {
			throwUserFacingError(
				"Dieser Lernblock ist nur eine Vorschau und kann sich noch ändern.",
			);
		}
		if (
			context.existingItemCount > 0 &&
			!context.needsLegacyContentReplacement
		) {
			if (
				!context.session.completed &&
				(!context.hasTheoryKnowledgeCheck ||
					!context.hasCompleteTheoryPracticePairs) &&
				isLearningSessionCompositionEligible({
					phase: context.session.phase,
					durationMinutes: context.session.durationMinutes,
				})
			) {
				return await ctx.runMutation(
					internal.learningSessionContent.backfillTheoryKnowledgeCheck,
					{ sessionId: args.sessionId },
				);
			}
			return { itemCount: context.existingItemCount };
		}
		if (context.session.sessionPurpose === "diagnostic") {
			throwUserFacingError(
				"Die Fragen des Wissenschecks fehlen. Erstelle den Lernplan erneut.",
			);
		}
		const claimed: boolean = await ctx.runMutation(
			internal.learningPlans.claimSessionContentGeneration,
			{ sessionId: args.sessionId },
		);
		if (!claimed) {
			const latest: LearningSessionContentAiContext = await ctx.runQuery(
				internal.learningSessionContent.getSessionGenerationContext,
				{ sessionId: args.sessionId },
			);
			return { itemCount: latest.existingItemCount };
		}
		const generated = await generateTrackedSessionContent(ctx, args.sessionId, {
			generationStatusClaimed: true,
		});
		await ctx.runMutation(internal.learningPlans.finalizeContentGeneration, {
			learningPlanId: context.session.learningPlanId,
		});
		if (generated.error) throw generated.error;
		if (!generated.result) {
			throw new Error("Session content generation returned no result.");
		}
		return generated.result;
	},
});

export const retryFailedSessionContent = action({
	args: { learningPlanId: v.id("learningPlans") },
	handler: async (
		ctx,
		args,
	): Promise<{
		attemptedSessionCount: number;
		failedSessionCount: number;
		isReady: boolean;
	}> => {
		const generationId = crypto.randomUUID();
		const sessionIds: Id<"learningPlanSessions">[] = await ctx.runMutation(
			internal.learningPlans.claimIncompleteContentGenerationSessions,
			{ learningPlanId: args.learningPlanId, generationId },
		);
		try {
			const planContext: LearningPlanAiContext = await ctx.runQuery(
				internal.learningPlans.getAiContext,
				{ learningPlanId: args.learningPlanId },
			);
			const { economyMode } = await getMonthlyCostMode(ctx, sessionIds.length);
			const preparedDocuments = await buildModelInputFromDocuments(
				ctx,
				planContext.documents,
				planContext.accessKey,
			);
			const batches = await buildSessionGenerationBatches(
				ctx,
				sessionIds,
				economyMode
					? ECONOMY_CONTENT_GENERATION_BATCH_SIZE
					: CONTENT_GENERATION_BATCH_SIZE,
			);
			const batchResults = await mapWithConcurrency(
				batches,
				CONTENT_GENERATION_CONCURRENCY,
				(contexts) =>
					generateTrackedSessionContentBatch(
						ctx,
						contexts,
						preparedDocuments,
						economyMode,
					),
			);
			const results: Awaited<
				ReturnType<typeof generateTrackedSessionContent>
			>[] = batchResults.flat();
			const finalState: {
				readySessionCount: number;
				failedSessionCount: number;
				isReady: boolean;
			} = await ctx.runMutation(
				internal.learningPlans.finalizeContentGeneration,
				{ learningPlanId: args.learningPlanId, generationId },
			);
			return {
				attemptedSessionCount: sessionIds.length,
				failedSessionCount: results.filter((result) => result.error).length,
				isReady: finalState.isReady,
			};
		} catch (error) {
			try {
				await ctx.runMutation(
					internal.learningPlans.markContentGenerationClaimFailed,
					{ learningPlanId: args.learningPlanId, generationId },
				);
			} catch (releaseError) {
				logDiagnosticError(
					"learningPlanAi.retryContentGeneration.releaseClaim",
					releaseError,
					{ learningPlanId: args.learningPlanId, generationId },
				);
			}
			throw error;
		}
	},
});

export const addSessionWithContent = action({
	args: { learningPlanId: v.id("learningPlans") },
	handler: async (
		ctx,
		args,
	): Promise<{ sessionId: Id<"learningPlanSessions">; itemCount: number }> => {
		const sessionId: Id<"learningPlanSessions"> = await ctx.runMutation(
			api.learningPlans.addSession,
			{ learningPlanId: args.learningPlanId },
		);
		const generated = await generateTrackedSessionContent(ctx, sessionId);
		if (generated.error || !generated.result) {
			await ctx.runMutation(api.learningPlans.removeSession, { id: sessionId });
			await ctx.runMutation(internal.learningPlans.finalizeContentGeneration, {
				learningPlanId: args.learningPlanId,
			});
			throw (
				generated.error ?? new Error("Session generation returned no result.")
			);
		}
		await ctx.runMutation(internal.learningPlans.finalizeContentGeneration, {
			learningPlanId: args.learningPlanId,
		});
		return { sessionId, itemCount: generated.result.itemCount };
	},
});

export const generateKnowledgeQuestions = action({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args): Promise<{ questionCount: number }> => {
		const context: LearningPlanAiContext = await ctx.runQuery(
			internal.learningPlans.getAiContext,
			{ learningPlanId: args.learningPlanId },
		);
		const schoolDocuments = context.documents.filter(
			(document) => (document.sourceKind ?? "school") === "school",
		);
		if (schoolDocuments.length === 0) {
			throwUserFacingError(
				"Lade zuerst mindestens eine Schulunterlage hoch, um einen Lernplan zu erhalten.",
			);
		}

		const { fileParts, sourceContext } = await buildModelInputFromDocuments(
			ctx,
			schoolDocuments,
			context.accessKey,
		);
		const model = createVertexModel();
		const userContent: Array<
			| { type: "text"; text: string }
			| { type: "file"; data: Buffer; mediaType: string; filename: string }
		> = [
			{
				type: "text",
				text: `${buildBaseContext(context)}

${TOPIC_MAP_GENERATION_INSTRUCTION}
Erstelle danach 5 bis 10 kurze, objektiv bewertbare Fragen für den Wissenscheck in der ersten Lernsession. Jede Frage muss als kind "performance" tatsächliches Wissen durch kurzes Lösen, Erklären oder Anwenden prüfen. Verwende keine Selbsteinschätzungs- oder Sicherheitsfragen. Ordne jede Frage über topicId exakt einer zuvor erzeugten Themen-ID und über evidenceDimension genau einer Evidenzdimension zu. Liefere außerdem eine fachlich richtige idealAnswer, eine kurze explanation und 1 bis 5 evaluationKeywords. Ziel ist nicht Notengebung, sondern belastbare Evidenz für den jeweils nächsten Lernschritt.
Die Fragen müssen sich konkret auf Prüfungsthema und Inhalte aus dem Material beziehen, aber wie normale Prüfungs- oder Verständnisfragen formuliert sein.
Jede Frage fragt genau eine Sache ab, ist ohne verschachtelte Arbeitsanweisung direkt verständlich und lässt sich in wenigen Sätzen beantworten.
Keine Frage darf eine andere Aufgabenformulierung zitieren oder Formulierungen wie „Erkläre deinen Lösungsweg zu …“ enthalten.
Verweise in den Fragen nie direkt auf Quellen oder Uploads: keine Formulierungen wie "laut Material", "im Dokument", "auf dem Bild", "in der Datei", "Material 3 sagt" und keine Dateinamen.
Wähle für jede Frage das Antwortformat mit der geringsten Reibung, das noch belastbare Evidenz liefert:
- multipleChoice für klare fachliche Unterscheidungen; liefere dann 3 bis 4 kurze plausible Optionen.
- shortText für Zahlen, Formeln, Begriffe oder Antworten bis ungefähr einem Satz; liefere dann options: [].
- longText nur wenn ein Lösungsweg oder eine Begründung wirklich beobachtet werden muss; liefere dann options: [].
Liefere für jede multipleChoice-Frage den nullbasierten correctOptionIndex der eindeutig richtigen Option. Für shortText und longText ist correctOptionIndex null.
Verwende bei 5 Fragen mindestens 2 Multiple-Choice-Fragen und höchstens 2 longText-Fragen. "Weiß ich nicht" wird separat von der App angeboten und gehört nicht in options.
Formuliere alle sichtbaren Texte in korrektem Deutsch mit Umlauten und Sonderzeichen: ä, ö, ü, Ä, Ö, Ü, ß. Verwende keine Ersatzschreibweisen wie ae, oe, ue oder ss, wenn ein Umlaut oder ß gemeint ist.`,
			},
		];

		if (sourceContext) {
			userContent.push({
				type: "text",
				text: `Auszüge aus dem Lernmaterial:\n${sourceContext}`,
			});
		}
		userContent.push(...fileParts);

		const { economyMode } = await getMonthlyCostMode(ctx);
		const diagnosticModelId =
			ENABLE_FLASH_LITE || economyMode ? FLASH_LITE_MODEL_ID : FLASH_MODEL_ID;
		const generatedQuestions = await withGeneratedTextRetry(async (attempt) => {
			const result = await runLlmGeneration((abortSignal) =>
				generateText({
					model: model(diagnosticModelId),
					temperature: 0.2,
					maxOutputTokens: 3_600,
					abortSignal,
					providerOptions: vertexProviderOptions,
					output: Output.object({ schema: questionsSchema }),
					system: `Du bist ein präziser Lerncoach für Schüler der 10. bis 12. Klasse in Deutschland. Antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`,
					messages: [{ role: "user", content: userContent }],
				}),
			);
			await recordAiUsage(ctx, {
				learningPlanId: args.learningPlanId,
				operation: "diagnostic",
				modelId: diagnosticModelId,
				usage: result.usage,
			});

			const questions = result.output.questions.map((question, index) => {
				const normalizedOptions = question.options.map((option) =>
					normalizeAiGeneratedGermanText(option),
				);
				const generatedOptions = normalizedOptions.filter(Boolean);
				const generatedCorrectAnswer =
					question.correctOptionIndex === null
						? undefined
						: normalizedOptions[question.correctOptionIndex] || undefined;
				const hasValidMultipleChoiceAnswer =
					question.correctOptionIndex !== null &&
					Boolean(generatedCorrectAnswer) &&
					generatedOptions.includes(generatedCorrectAnswer ?? "");
				const responseKind =
					question.responseKind === "multipleChoice" &&
					(generatedOptions.length < 2 || !hasValidMultipleChoiceAnswer)
						? "shortText"
						: question.responseKind;
				const options =
					responseKind === "multipleChoice" ? generatedOptions : [];

				return {
					id: `q${index + 1}`,
					topicId: question.topicId,
					kind: "performance" as const,
					evidenceDimension: question.evidenceDimension,
					responseKind,
					options,
					correctAnswer:
						responseKind === "multipleChoice"
							? generatedCorrectAnswer
							: undefined,
					prompt: normalizeAiGeneratedGermanText(question.prompt),
					targetInsight: normalizeAiGeneratedGermanText(question.targetInsight),
					idealAnswer: normalizeAiGeneratedGermanText(question.idealAnswer),
					explanation: normalizeAiGeneratedGermanText(question.explanation),
					evaluationKeywords: question.evaluationKeywords.map((keyword) =>
						normalizeAiGeneratedGermanText(keyword),
					),
				};
			});

			return {
				questions,
				topics: result.output.topics.map((topic) => ({
					id: topic.id,
					title: normalizeAiGeneratedGermanText(topic.title),
					learningGoal: normalizeAiGeneratedGermanText(topic.learningGoal),
					keywords: topic.keywords.map((keyword) =>
						normalizeAiGeneratedGermanText(keyword),
					),
					priority: topic.priority,
					requiredEvidenceDimensions: topic.requiredEvidenceDimensions,
				})),
				sourceSummary: normalizeAiGeneratedGermanText(
					result.output.sourceSummary,
				),
			};
		}, "Der Wissenscheck konnte nicht zuverlässig erstellt werden. Prüfe deine Schulunterlagen und versuche es erneut.");

		await ctx.runMutation(internal.learningPlans.storeKnowledgeQuestions, {
			learningPlanId: args.learningPlanId,
			questions: generatedQuestions.questions,
			topics: generatedQuestions.topics,
			sourceSummary: generatedQuestions.sourceSummary,
			diagnosticPlacement: "firstSession",
		});

		return { questionCount: generatedQuestions.questions.length };
	},
});

export const generatePlan = action({
	args: {
		learningPlanId: v.id("learningPlans"),
		sessionCompositionVariant: v.optional(
			v.union(v.literal("control"), v.literal("split")),
		),
		answers: v.array(
			v.object({
				questionId: v.string(),
				answer: v.string(),
			}),
		),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		sessionCount: number;
		contentSessionCount: number;
		compositionEligibleSessionCount: number;
	}> => {
		const generationId = globalThis.crypto.randomUUID();
		await ctx.runMutation(internal.learningPlans.beginContentGeneration, {
			learningPlanId: args.learningPlanId,
			generationId,
		});
		try {
			const initialCostMode = await getMonthlyCostMode(ctx);
			const context: LearningPlanAiContext = await ctx.runQuery(
				internal.learningPlans.getAiContext,
				{ learningPlanId: args.learningPlanId },
			);
			if (context.plan.diagnosticPlacement !== "firstSession") {
				throwUserFacingError(
					"Erstelle zuerst den Wissenscheck neu. Er ist der erste Block jedes Lernplans.",
				);
			}
			const questions = context.plan.knowledgeQuestions ?? [];
			const usesFirstSessionDiagnostic =
				context.plan.diagnosticPlacement === "firstSession";
			const maximumQuestionCount = usesFirstSessionDiagnostic ? 10 : 8;
			if (questions.length < 5 || questions.length > maximumQuestionCount) {
				throwUserFacingError("Die Fragen für den Wissenscheck fehlen noch.");
			}

			const effectiveAnswers = usesFirstSessionDiagnostic ? [] : args.answers;
			const answersByQuestion = new Map(
				effectiveAnswers.map((answer) => [
					answer.questionId,
					answer.answer.trim(),
				]),
			);
			const qaText = usesFirstSessionDiagnostic
				? questions
						.map(
							(question, index) =>
								`${index + 1}. Frage im zukünftigen Wissenscheck: ${question.prompt}\nNoch nicht beantwortet.`,
						)
						.join("\n\n")
				: questions
						.map((question, index) => {
							const answer =
								answersByQuestion.get(question.id) || "Keine Antwort";
							return `${index + 1}. Frage: ${question.prompt}\nAntwort: ${answer}\nAnalyseziel: ${question.targetInsight}`;
						})
						.join("\n\n");

			const availableDays = getAvailableDays(context.plan.examDateKey);
			const confirmedTotalStudyMinutes = context.plan.targetStudyMinutes;
			const availableLearningSlots =
				confirmedTotalStudyMinutes !== undefined &&
				Number.isInteger(confirmedTotalStudyMinutes) &&
				confirmedTotalStudyMinutes >= MIN_LEARNING_SLOT_MINUTES &&
				buildLearningSlots(
					context.plan.examDateKey,
					availableDays,
					context.learningTimes,
					context.occupiedEntries,
					confirmedTotalStudyMinutes,
					20,
					usesFirstSessionDiagnostic ? 2 : 1,
				);
			if (
				availableLearningSlots !== false &&
				availableLearningSlots.length < (usesFirstSessionDiagnostic ? 2 : 1)
			) {
				throwUserFacingError(
					getEmptyScheduleErrorMessage(
						context.learningTimes,
						context.occupiedEntries,
					),
				);
			}
			const { fileParts, sourceContext } = await buildModelInputFromDocuments(
				ctx,
				context.documents,
				context.accessKey,
			);
			const sessionCompositionVariant =
				args.sessionCompositionVariant ??
				context.plan.sessionCompositionVariant ??
				"split";
			const personalLearningTimes = describeLearningTimes(
				context.learningTimes,
			);
			const model = createVertexModel();
			const userContent: Array<
				| { type: "text"; text: string }
				| { type: "file"; data: Buffer; mediaType: string; filename: string }
			> = [
				{
					type: "text",
					text: `${buildBaseContext(context)}
Verfügbare Tage bis zur Prüfung: ${availableDays}
Bestätigte gesamte Lernzeit: ${confirmedTotalStudyMinutes ?? "Noch nicht bestätigt"} Minuten
Persönliche Lernzeiten aus den Einstellungen:
${personalLearningTimes}

${usesFirstSessionDiagnostic ? "Wissenscheck in der ersten Session (noch unbeantwortet)" : "Wissensanalyse"}:
${qaText}

${usesFirstSessionDiagnostic ? "Erstelle die Kalendergrundlage für den Wissenscheck und den ersten vorläufigen Lernschritt. Der Wissenscheck wird erst in der ersten Session beantwortet." : "Erstelle einen konkreten Lernplan, der die Antworten sichtbar berücksichtigt."}
MVP-Vorgabe:
- Interne Schulmaterialien und Hinweise der Lehrkraft definieren den wahrscheinlichen Prüfungsstoff. Externe Lernhilfen dürfen Erklärungen und Übungsformen verbessern, aber niemals neue Prüfungsthemen einführen.
- Baue, wenn zeitlich möglich, die Phasen Theorie, Üben und Generalprobe.
- Theorie nur bis zur Mindestbeherrschung planen.
- Der größte Block soll die Übungsphase sein.
- Die Generalprobe soll wie ein fertiger Test/Probetest formuliert sein.
- Jeder Lernblock braucht konkrete Aufgaben, die der Schüler in diesem Slot abarbeitet.
- Formuliere alle sichtbaren Texte (sourceSummary, insight, Titel, goal, tasks, expectedOutcome) in korrektem Deutsch mit Umlauten und Sonderzeichen: ä, ö, ü, Ä, Ö, Ü, ß. Verwende keine Ersatzschreibweisen wie ae, oe, ue oder ss, wenn ein Umlaut oder ß gemeint ist.
- Session-Titel müssen kurze UI-Labels mit maximal ${MAX_SESSION_TITLE_CHARS} Zeichen sein.
- Nenne in Session-Titeln, goal, tasks und expectedOutcome keine Dauer in Minuten. Die tatsächliche Session-Dauer wird anschließend aus den persönlichen Lernzeiten festgelegt und separat angezeigt.
- insight.strengths darf maximal 4 Punkte enthalten, insight.gaps maximal 5 Punkte.
- Gib höchstens 2 fachlich unterschiedliche Session-Archetypen für die unmittelbar nächsten Lernschritte zurück. Spätere Schritte werden erst nach neuer Lernevidenz festgelegt.
- ${usesFirstSessionDiagnostic ? "Der erste Kalender-Slot ist für den Wissenscheck reserviert, der zweite für einen vorläufigen Lernschritt. Behaupte vor dem Wissenscheck keine beobachteten Stärken: insight.strengths muss leer sein. Formuliere Lücken nur als noch zu prüfende oder zunächst abzudeckende Bereiche." : "Berücksichtige die bereits beantworteten Einstiegsfragen bei Stärken und Lücken."}
- Bevorzuge mehrere kurze Session-Archetypen: Theorie 10–15 Min., angeleitetes Üben 10–20 Min. und Praxis 20–30 Min. Vermeide lange Sammelblöcke.
- Plane fachlich sinnvolle Lernblöcke, aber die finale Kalenderplatzierung erfolgt ausschließlich innerhalb der persönlichen Lernzeiten. Verwende keine anderen Tage oder Uhrzeiten als Empfehlung.
- Nutze dayOffsetBeforeExam relativ zum Prüfungstag: 1 = einen Tag vor der Prüfung.
- Verteile mehrere Sessions auf unterschiedliche Kalendertage, solange genug Tage verfügbar sind. Wiederhole dayOffsetBeforeExam nicht, wenn eine Alternative möglich ist.
- Wenn Antworten nur Platzhalter oder Unsinn enthalten, erstelle trotzdem einen remedialen Grundlagenplan und setze strengths auf [].
- Wenn zu wenig Zeit bleibt, reduziere die Anzahl der Sessions, aber bleibe konkret.`,
				},
			];

			if (sourceContext) {
				userContent.push({
					type: "text",
					text: `Auszüge aus dem Lernmaterial:\n${sourceContext}`,
				});
			}
			userContent.push(...fileParts);

			const normalizeGeneratedPlan = (
				output: z.infer<typeof generatedPlanSchema>,
				extraPlanningHint?: string,
			) => {
				const normalizedInsight = {
					summary: normalizeAiGeneratedGermanText(output.insight.summary),
					strengths: usesFirstSessionDiagnostic
						? []
						: output.insight.strengths.map((strength) =>
								normalizeAiGeneratedGermanText(strength),
							),
					gaps: output.insight.gaps.map((gap) =>
						normalizeAiGeneratedGermanText(gap),
					),
				};
				const preparationDepth =
					context.plan.preparationDepth ??
					getDefaultPreparationDepth(context.plan.examTypeLabel);
				const topicCount = Math.max(
					context.plan.topicMap?.length ?? 0,
					effectiveAnswers.length,
				);
				const readiness = context.plan.topicReadiness ?? [];
				const secureTopicCount = readiness.filter(
					(topic) => topic.status === "secure",
				).length;
				const developingTopicCount = readiness.filter(
					(topic) => topic.status === "developing",
				).length;
				const unknownTopicCount = readiness.filter(
					(topic) => topic.status === "unknown",
				).length;
				const topicReadiness: TopicReadinessCounts = {
					unknown: Math.max(unknownTopicCount, topicCount - readiness.length),
					secure: secureTopicCount,
					developing: developingTopicCount,
				};
				const preparationRecommendation = recommendLearningPreparation({
					examTypeLabel: context.plan.examTypeLabel,
					examDurationMinutes: context.plan.durationMinutes,
					preparationDepth,
					topicReadiness,
				});
				const normalized = normalizeSessions(
					context.plan.examDateKey,
					availableDays,
					output.sessions,
					context.learningTimes,
					context.occupiedEntries,
					confirmedTotalStudyMinutes,
					focusLearningTopics({
						topics: context.plan.topicMap ?? [],
						strengths: normalizedInsight.strengths,
						gaps: normalizedInsight.gaps,
					}),
					{
						maxSessionMinutes: 20,
						minimumSessionCount: usesFirstSessionDiagnostic ? 2 : 1,
						topicReadiness,
						praxisSessionCount: preparationRecommendation.praxisSessionCount,
					},
				);

				return {
					sourceSummary: normalizeAiGeneratedGermanText(output.sourceSummary),
					insight: normalizedInsight,
					sessions: normalized.sessions,
					planningHint: [extraPlanningHint, normalized.planningHint]
						.filter(Boolean)
						.join(" "),
				};
			};

			const planFallbackMessage = usesFirstSessionDiagnostic
				? "Aus den Unterlagen konnte kein stabiler Start für den Lernplan erstellt werden. Prüfe den erkannten Prüfungsstoff und versuche es erneut."
				: "Aus diesen Antworten konnte kein stabiler Lernplan erstellt werden. Ergänze mindestens ein paar konkrete Stichworte zu deinem Wissensstand und versuche es erneut.";
			const planModelId =
				ENABLE_FLASH_LITE || initialCostMode.economyMode
					? FLASH_LITE_MODEL_ID
					: FLASH_MODEL_ID;
			const generatedPlan = await withGeneratedTextRetry(async (attempt) => {
				const result = await runLlmGeneration((abortSignal) =>
					generateText({
						model: model(planModelId),
						temperature: 0.25,
						maxOutputTokens: 3_200,
						abortSignal,
						providerOptions: vertexProviderOptions,
						output: Output.object({ schema: generatedPlanSchema }),
						system: `Du bist ein strenger, praxisnaher Lernplaner. Plane nur realistische, kalendereignete Lernslots und antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`,
						messages: [{ role: "user", content: userContent }],
					}),
				);
				await recordAiUsage(ctx, {
					learningPlanId: args.learningPlanId,
					operation: "plan",
					modelId: planModelId,
					usage: result.usage,
				});

				return normalizeGeneratedPlan(result.output);
			}, planFallbackMessage);
			if (
				generatedPlan.sessions.length < (usesFirstSessionDiagnostic ? 2 : 1)
			) {
				throwUserFacingError(
					getEmptyScheduleErrorMessage(
						context.learningTimes,
						context.occupiedEntries,
					),
				);
			}

			const replacement: {
				sessionIds: Id<"learningPlanSessions">[];
				contentSessionIds: Id<"learningPlanSessions">[];
			} | null = await ctx.runMutation(
				internal.learningPlans.replaceGeneratedSessions,
				{
					learningPlanId: args.learningPlanId,
					knowledgeAnswersJson: JSON.stringify(effectiveAnswers),
					sourceSummary: generatedPlan.sourceSummary,
					insight: generatedPlan.insight,
					planningHint: generatedPlan.planningHint,
					sessionCompositionVariant,
					deferReadyUntilContent: true,
					deferFutureContent: true,
					rollingWindow: true,
					generationId,
					sessions: generatedPlan.sessions,
				},
			);
			const sessionIds = replacement?.contentSessionIds ?? [];
			const projectedCostMode = await getMonthlyCostMode(
				ctx,
				sessionIds.length,
			);
			const economyMode =
				initialCostMode.economyMode || projectedCostMode.economyMode;
			const contentBatches = await buildSessionGenerationBatches(
				ctx,
				sessionIds,
				economyMode
					? ECONOMY_CONTENT_GENERATION_BATCH_SIZE
					: CONTENT_GENERATION_BATCH_SIZE,
			);
			const batchedContentResults = await mapWithConcurrency(
				contentBatches,
				CONTENT_GENERATION_CONCURRENCY,
				(contexts) =>
					generateTrackedSessionContentBatch(
						ctx,
						contexts,
						{
							fileParts,
							sourceContext,
						},
						economyMode,
					),
			);
			const contentResults = batchedContentResults.flat();
			const finalState: {
				readySessionCount: number;
				failedSessionCount: number;
				isReady: boolean;
			} = await ctx.runMutation(
				internal.learningPlans.finalizeContentGeneration,
				{ learningPlanId: args.learningPlanId, generationId },
			);
			const failedSessionCount = contentResults.filter(
				(result) => result.error,
			).length;
			if (!finalState.isReady || failedSessionCount > 0) {
				throwUserFacingError(
					`${failedSessionCount || finalState.failedSessionCount} Lernsessionen konnten noch nicht vorbereitet werden. Versuche nur diese Sessionen erneut.`,
				);
			}

			return {
				sessionCount: replacement?.sessionIds.length ?? 0,
				contentSessionCount: finalState.readySessionCount,
				compositionEligibleSessionCount: generatedPlan.sessions
					.slice(0, replacement?.sessionIds.length ?? 0)
					.filter(isLearningSessionCompositionEligible).length,
			};
		} catch (error) {
			await ctx.runMutation(
				internal.learningPlans.clearEmptyContentGeneration,
				{ learningPlanId: args.learningPlanId, generationId },
			);
			throw error;
		}
	},
});
