"use node";

import { createVertex } from "@ai-sdk/google-vertex";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { parseOffice } from "officeparser";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { createManagedReadUrl, type StorageProvider } from "./fileStorage";
import { readOptionalEnv, readRequiredEnv } from "./env";

const MAX_UPLOAD_FILE_BYTES = 7 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 90_000;
const MAX_PROMPT_CONTEXT_CHARS = 70_000;
const LLM_GENERATION_TIMEOUT_MS = 60_000;
const MODEL_ID = "gemini-3-flash-preview";

const vertexProviderOptions = {
	google: {
		thinkingConfig: {
			thinkingBudget: 0,
		},
	},
} as const;

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

const questionsSchema = z.object({
	sourceSummary: z.string().min(20),
	questions: z
		.array(
			z.object({
				prompt: z.string().min(12),
				targetInsight: z.string().min(8),
			}),
		)
		.length(5),
});

const sessionPhaseSchema = z.enum(["theory", "practice", "rehearsal"]);

const generatedPlanSchema = z.object({
	sourceSummary: z.string().min(20),
	insight: z.object({
		summary: z.string().min(20),
		strengths: z.array(z.string()).max(4),
		gaps: z.array(z.string()).min(1).max(5),
		strategy: z.string().min(20),
	}),
	sessions: z
		.array(
			z.object({
				phase: sessionPhaseSchema,
				title: z.string().min(3).max(28),
				dayOffsetBeforeExam: z.number().int().min(0).max(120),
				startTime: z.string().regex(/^\d{2}:\d{2}$/),
				durationMinutes: z.number().int().min(15).max(180),
				goal: z.string().min(20),
				tasks: z.array(z.string().min(8)).min(2).max(5),
				expectedOutcome: z.string().min(12),
			}),
		)
		.min(1)
		.max(5),
});

type LearningPlanAiContext = {
	plan: {
		_id: Id<"learningPlans">;
		subject: string;
		examTypeLabel: string;
		examDateKey: string;
		examDateLabel: string;
		examTime: string;
		durationMinutes: number;
		topicDescription: string;
		notes?: string;
		knowledgeQuestions?: Array<{
			id: string;
			prompt: string;
			targetInsight: string;
		}>;
	};
	documents: Array<{
		storageId: string;
		storageProvider: StorageProvider;
		fileName: string;
		fileType: string;
		fileSizeBytes: number;
	}>;
	accessKey: string;
};

type ModelDocumentInput = {
	storageId: string;
	storageProvider: StorageProvider;
	fileName: string;
	fileType: string;
	fileSizeBytes: number;
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
			console.warn("AI structured output validation failed", {
				finishReason: error.finishReason,
				text: error.text?.slice(0, 500),
				cause: error.cause,
			});
			throw new Error(fallbackMessage);
		}

		throw error;
	}
};

const compactText = (value: string, maxChars: number) => {
	const normalized = value
		.replace(/\r/g, "")
		.replace(/\t/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	if (normalized.length <= maxChars) return normalized;

	return `${normalized.slice(0, maxChars)}\n\n[Inhalt wurde gekürzt.]`;
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
			throw new Error(
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
		);
		const response = await fetch(downloadUrl);
		if (!response.ok) {
			throw new Error(`Datei-Download fehlgeschlagen: ${document.fileName}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		if (arrayBuffer.byteLength > MAX_UPLOAD_FILE_BYTES) {
			throw new Error(
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
				textSections.push(`Datei: ${document.fileName}\n${extractedText}`);
			}
		} catch {
			// Images and some PDFs are still useful as native model inputs.
		}

		if (isVertexNativeCandidate(mediaType, document.fileName)) {
			fileParts.push({
				type: "file",
				data: buffer,
				mediaType,
				filename: document.fileName,
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

const getAvailableDays = (examDateKey: string) => {
	const examTime = new Date(examDateKey).getTime();
	if (!Number.isFinite(examTime)) return 7;

	return Math.max(0, Math.ceil((examTime - Date.now()) / 86_400_000));
};

const formatDateLabel = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		timeZone: "Europe/Berlin",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);

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

const normalizeSessions = (
	examDateKey: string,
	availableDays: number,
	sessions: z.infer<typeof generatedPlanSchema>["sessions"],
) => {
	const maxOffset = Math.max(availableDays, 0);
	return sessions
		.map((session) => {
			const boundedOffset = Math.min(
				Math.max(session.dayOffsetBeforeExam, availableDays > 0 ? 1 : 0),
				maxOffset,
			);
			const date = buildDateFromOffset(examDateKey, boundedOffset);
			return {
				phase: session.phase,
				title: session.title.trim(),
				dateKey: date.toISOString(),
				dateLabel: formatDateLabel(date),
				startTime: session.startTime,
				durationMinutes: session.durationMinutes,
				goal: session.goal.trim(),
				tasks: session.tasks.map((task) => task.trim()).filter(Boolean),
				expectedOutcome: session.expectedOutcome.trim(),
			};
		})
		.sort((left, right) => left.dateKey.localeCompare(right.dateKey));
};

const buildBaseContext = (context: LearningPlanAiContext) => {
	const { plan, documents } = context;
	return [
		`Fach: ${plan.subject}`,
		`Prüfungsart: ${plan.examTypeLabel}`,
		`Prüfungstermin: ${plan.examDateLabel}, ${plan.examTime}`,
		`Bearbeitungszeit der Prüfung: ${plan.durationMinutes} Minuten`,
		`Prüfungsthema: ${plan.topicDescription}`,
		plan.notes ? `Notizen: ${plan.notes}` : "",
		`Hochgeladene Materialien: ${documents.length}`,
	]
		.filter(Boolean)
		.join("\n");
};

export const generateKnowledgeQuestions = action({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const context: LearningPlanAiContext = await ctx.runQuery(
			internal.learningPlans.getAiContext,
			{ learningPlanId: args.learningPlanId },
		);
		if (!context.plan.topicDescription.trim()) {
			throw new Error("Beschreibe zuerst das Prüfungsthema.");
		}

		const { fileParts, sourceContext } = await buildModelInputFromDocuments(
			ctx,
			context.documents,
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

Erstelle genau 5 kurze Wissensanalyse-Fragen. Ziel ist nicht Notengebung, sondern herauszufinden, welche Lernblöcke der Lernplan braucht.
Die Fragen müssen sich konkret auf Prüfungsthema und Material beziehen. Keine Multiple-Choice-Fragen. Keine Diktierfunktion erwähnen.`,
			},
		];

		if (sourceContext) {
			userContent.push({
				type: "text",
				text: `Auszüge aus dem Lernmaterial:\n${sourceContext}`,
			});
		}
		userContent.push(...fileParts);

		const result = await withStructuredOutputErrorHandling(
			() =>
				generateText({
					model: model(MODEL_ID),
					temperature: 0.2,
					maxOutputTokens: 1_800,
					timeout: { totalMs: LLM_GENERATION_TIMEOUT_MS },
					providerOptions: vertexProviderOptions,
					output: Output.object({ schema: questionsSchema }),
					system:
						"Du bist ein präziser Lerncoach für Schüler der 10. bis 12. Klasse in Sachsen. Antworte ausschließlich im vorgegebenen JSON-Schema.",
					messages: [{ role: "user", content: userContent }],
				}),
			"Die Wissensanalyse konnte nicht zuverlässig erstellt werden. Formuliere das Prüfungsthema etwas konkreter und versuche es erneut.",
		);

		const questions = result.output.questions.map((question, index) => ({
			id: `q${index + 1}`,
			prompt: question.prompt,
			targetInsight: question.targetInsight,
		}));

		await ctx.runMutation(internal.learningPlans.storeKnowledgeQuestions, {
			learningPlanId: args.learningPlanId,
			questions,
			sourceSummary: result.output.sourceSummary,
		});

		return { questionCount: questions.length };
	},
});

export const generatePlan = action({
	args: {
		learningPlanId: v.id("learningPlans"),
		answers: v.array(
			v.object({
				questionId: v.string(),
				answer: v.string(),
			}),
		),
	},
	handler: async (ctx, args) => {
		const context: LearningPlanAiContext = await ctx.runQuery(
			internal.learningPlans.getAiContext,
			{ learningPlanId: args.learningPlanId },
		);
		const questions = context.plan.knowledgeQuestions ?? [];
		if (questions.length !== 5) {
			throw new Error("Die Wissensanalyse-Fragen fehlen noch.");
		}

		const answersByQuestion = new Map(
			args.answers.map((answer) => [answer.questionId, answer.answer.trim()]),
		);
		const qaText = questions
			.map((question, index) => {
				const answer = answersByQuestion.get(question.id) || "Keine Antwort";
				return `${index + 1}. Frage: ${question.prompt}\nAntwort: ${answer}\nAnalyseziel: ${question.targetInsight}`;
			})
			.join("\n\n");

		const { fileParts, sourceContext } = await buildModelInputFromDocuments(
			ctx,
			context.documents,
			context.accessKey,
		);
		const availableDays = getAvailableDays(context.plan.examDateKey);
		const model = createVertexModel();
		const userContent: Array<
			| { type: "text"; text: string }
			| { type: "file"; data: Buffer; mediaType: string; filename: string }
		> = [
			{
				type: "text",
				text: `${buildBaseContext(context)}
Verfügbare Tage bis zur Prüfung: ${availableDays}

Wissensanalyse:
${qaText}

Erstelle einen konkreten Lernplan, der die Antworten sichtbar berücksichtigt.
MVP-Vorgabe:
- Baue, wenn zeitlich möglich, die Phasen Theorie, Üben und Generalprobe.
- Theorie nur bis zur Mindestbeherrschung planen.
- Der größte Block soll die Übungsphase sein.
- Die Generalprobe soll wie ein fertiger Test/Probetest formuliert sein.
- Jeder Lernblock braucht konkrete Aufgaben, die der Schüler in diesem Slot abarbeitet.
- Nutze dayOffsetBeforeExam relativ zum Prüfungstag: 1 = einen Tag vor der Prüfung.
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

		const result = await withStructuredOutputErrorHandling(
			() =>
				generateText({
					model: model(MODEL_ID),
					temperature: 0.25,
					maxOutputTokens: 3_200,
					timeout: { totalMs: LLM_GENERATION_TIMEOUT_MS },
					providerOptions: vertexProviderOptions,
					output: Output.object({ schema: generatedPlanSchema }),
					system:
						"Du bist ein strenger, praxisnaher Lernplaner. Plane nur realistische, kalendereignete Lernslots und antworte ausschließlich im vorgegebenen JSON-Schema.",
					messages: [{ role: "user", content: userContent }],
				}),
			"Aus diesen Antworten konnte kein stabiler Lernplan erstellt werden. Ergänze mindestens ein paar konkrete Stichworte zu deinem Wissenstand und versuche es erneut.",
		);

		const sessions = normalizeSessions(
			context.plan.examDateKey,
			availableDays,
			result.output.sessions,
		);
		if (sessions.length === 0) {
			throw new Error("Die KI hat keine nutzbaren Lerntage erzeugt.");
		}

		await ctx.runMutation(internal.learningPlans.replaceGeneratedSessions, {
			learningPlanId: args.learningPlanId,
			knowledgeAnswersJson: JSON.stringify(args.answers),
			sourceSummary: result.output.sourceSummary,
			insight: result.output.insight,
			sessions,
		});

		return { sessionCount: sessions.length };
	},
});
