"use node";

import { createVertex } from "@ai-sdk/google-vertex";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { v } from "convex/values";
import { parseOffice } from "officeparser";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, action } from "./_generated/server";
import { readOptionalEnv, readRequiredEnv } from "./env";
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
import { repairGeneratedGermanTextFromAsciiShadow } from "./generatedGermanTextRepair";
import { assertMeaningfulTopicDescription } from "./topicDescriptionValidation";

const MAX_UPLOAD_FILE_BYTES = 7 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 90_000;
const MAX_PROMPT_CONTEXT_CHARS = 70_000;
const MAX_SESSION_TITLE_CHARS = 28;
const LLM_GENERATION_TIMEOUT_MS = 60_000;
const MAX_GENERATED_TEXT_ATTEMPTS = 3;
const MODEL_ID = "gemini-3-flash-preview";
const MIN_LEARNING_SLOT_MINUTES = 10;
const MAX_GENERATED_SESSIONS = 20;
const ALTERNATIVE_SLOT_MINUTES = 30;
const MAX_ALTERNATIVE_SESSIONS = 6;
const GERMAN_UI_TEXT_RULE =
	"All visible German UI text must use correct umlauts and ß, not ae/oe/ue/ss substitutions.";
const GERMAN_TEXT_SHADOW_RULE =
	"For every generated German text object, `text` is the visible German text and `asciiShadow` is the exact same wording with only ä->ae, ö->oe, ü->ue, Ä->Ae, Ö->Oe, Ü->Ue, ß->ss transliterated.";
const KNOWLEDGE_QUESTIONS_OUTPUT_DESCRIPTION = `${GERMAN_UI_TEXT_RULE} Return exactly five short diagnostic questions that reveal what the learning plan needs to cover.`;
const GENERATED_PLAN_OUTPUT_DESCRIPTION = `${GERMAN_UI_TEXT_RULE} Return a realistic, calendar-ready German learning plan with concrete study sessions.`;

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

const sessionPhaseSchema = z.enum(["theory", "practice", "rehearsal"]);

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

const germanTextSchema = (minLength: number, description: string) =>
	z
		.object({
			text: z
				.string()
				.min(minLength)
				.describe(`${description} ${GERMAN_UI_TEXT_RULE}`),
			asciiShadow: z
				.string()
				.min(minLength)
				.describe(
					`Exact non-visible transliteration for the text field. ${GERMAN_TEXT_SHADOW_RULE}`,
				),
		})
		.describe(`${description} ${GERMAN_TEXT_SHADOW_RULE}`);

type GeneratedGermanText = z.infer<ReturnType<typeof germanTextSchema>>;

const questionsSchema = z
	.object({
		sourceSummary: germanTextSchema(
			20,
			"Brief German summary of the uploaded learning material.",
		),
		questions: exactArray(
			z.object({
				prompt: germanTextSchema(
					12,
					"Short German diagnostic question for the student. No multiple choice and no references to files or uploads.",
				),
				targetInsight: germanTextSchema(
					8,
					"What this answer reveals about the student's strengths, gaps, or needed learning blocks.",
				),
			}),
			5,
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
		: " Die vorherige Ausgabe enthielt ungültige oder widersprüchliche Sonderzeichen. Erzeuge alle text/asciiShadow-Paare vollständig neu: text mit echten Unicode-Zeichen wie ä, ö, ü, Ä, Ö, Ü und ß; asciiShadow mit exakt derselben Formulierung und nur ae/oe/ue/Ae/Oe/Ue/ss als Umschrift.";

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
			if (
				isInvalidGeneratedGermanTextError(error) &&
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

			throw error;
		}
	}

	throwUserFacingError(fallbackMessage);
};

const withLlmTimeout = async <TResult>(
	task: (abortSignal: AbortSignal) => Promise<TResult>,
) => {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		LLM_GENERATION_TIMEOUT_MS,
	);

	try {
		return await task(controller.signal);
	} finally {
		clearTimeout(timeoutId);
	}
};

const normalizeAiGeneratedGermanText = (value: GeneratedGermanText) =>
	normalizeGeneratedGermanText(
		repairGeneratedGermanTextFromAsciiShadow(value.text, value.asciiShadow),
	);

const toAsciiShadow = (value: string) =>
	value
		.replace(/Ä/g, "Ae")
		.replace(/Ö/g, "Oe")
		.replace(/Ü/g, "Ue")
		.replace(/ä/g, "ae")
		.replace(/ö/g, "oe")
		.replace(/ü/g, "ue")
		.replace(/ß/g, "ss");

const generatedGermanText = (text: string): GeneratedGermanText => ({
	text,
	asciiShadow: toAsciiShadow(text),
});

const compactText = (value: string, maxChars: number) => {
	const normalized = value
		.replace(/\r/g, "")
		.replace(/\t/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	if (normalized.length <= maxChars) return normalized;

	return `${normalized.slice(0, maxChars)}\n\n[Inhalt wurde gekürzt.]`;
};

const compactSingleLine = (value: string, maxChars: number) => {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxChars) return normalized;

	const ellipsis = "...";
	const contentMaxChars = maxChars - ellipsis.length;
	const clipped = normalized.slice(0, contentMaxChars).trimEnd();
	const lastSpace = clipped.lastIndexOf(" ");
	const compacted =
		lastSpace >= Math.floor(contentMaxChars * 0.55)
			? clipped.slice(0, lastSpace).trimEnd()
			: clipped;
	return `${compacted}${ellipsis}`;
};

const fallbackTitleByPhase: Record<
	z.infer<typeof sessionPhaseSchema>,
	string
> = {
	theory: "Theorie-Block",
	practice: "Übungsblock",
	rehearsal: "Generalprobe",
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
				textSections.push(extractedText);
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

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);

const formatTimeFromMinutes = (minutes: number) => {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return `${hours.toString().padStart(2, "0")}:${rest
		.toString()
		.padStart(2, "0")}`;
};

const parseTimeToMinutes = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}

	return hours * 60 + minutes;
};

const getBerlinDayOfWeek = (date: Date) => {
	const value = new Intl.DateTimeFormat("en-US", {
		timeZone: "Europe/Berlin",
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
	isAlternative?: boolean;
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

		const start = parseTimeToMinutes(entry.time);
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

const buildAlternativeLearningSlots = (
	examDateKey: string,
	availableDays: number,
	windowsByDay: Map<number, LearningTimeWindow[]>,
	occupiedIntervalsByDay: Map<string, Array<{ start: number; end: number }>>,
	neededMinutes: number,
) => {
	const slots: LearningSlot[] = [];
	let remainingMinutes = neededMinutes;
	if (remainingMinutes < MIN_LEARNING_SLOT_MINUTES) return slots;

	for (let offset = availableDays; offset >= 1; offset -= 1) {
		const date = buildDateFromOffset(examDateKey, offset);
		const dateKey = formatDateKey(date);
		const windows = windowsByDay.get(getBerlinDayOfWeek(date)) ?? [];
		const occupiedIntervals = occupiedIntervalsByDay.get(dateKey) ?? [];

		for (const window of windows) {
			const startMinutes = parseTimeToMinutes(window.startTime);
			const endMinutes = parseTimeToMinutes(window.endTime);
			if (
				startMinutes === null ||
				endMinutes === null ||
				endMinutes <= startMinutes
			) {
				continue;
			}

			const blockingIntervals = occupiedIntervals.filter((interval) =>
				overlapsInterval(interval, { start: startMinutes, end: endMinutes }),
			);
			let candidateStart = Math.max(
				endMinutes,
				...blockingIntervals.map((interval) => interval.end),
			);
			while (
				remainingMinutes >= MIN_LEARNING_SLOT_MINUTES &&
				slots.length < MAX_ALTERNATIVE_SESSIONS
			) {
				const durationMinutes = Math.min(
					ALTERNATIVE_SLOT_MINUTES,
					remainingMinutes,
				);
				const candidate = {
					start: candidateStart,
					end: candidateStart + durationMinutes,
				};
				if (candidate.end > 22 * 60) break;
				if (
					occupiedIntervals.some((interval) =>
						overlapsInterval(candidate, interval),
					)
				) {
					candidateStart += ALTERNATIVE_SLOT_MINUTES;
					continue;
				}

				slots.push({
					date,
					dateKey,
					startMinutes: candidate.start,
					endMinutes: candidate.end,
					isAlternative: true,
				});
				remainingMinutes -= durationMinutes;
				candidateStart = candidate.end;
			}
			if (
				remainingMinutes < MIN_LEARNING_SLOT_MINUTES ||
				slots.length >= MAX_ALTERNATIVE_SESSIONS
			) {
				return slots;
			}
		}
	}

	return slots;
};

const buildLearningSlots = (
	examDateKey: string,
	availableDays: number,
	learningTimes: LearningTimeWindow[],
	occupiedEntries: OccupiedEntry[],
	requestedMinutes: number,
) => {
	const windowsByDay = new Map<number, LearningTimeWindow[]>();
	for (const learningTime of learningTimes) {
		const startMinutes = parseTimeToMinutes(learningTime.startTime);
		const endMinutes = parseTimeToMinutes(learningTime.endTime);
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
	const slots: LearningSlot[] = [];
	for (let offset = availableDays; offset >= 1; offset -= 1) {
		const date = buildDateFromOffset(examDateKey, offset);
		const dateKey = formatDateKey(date);
		const windows = windowsByDay.get(getBerlinDayOfWeek(date)) ?? [];

		for (const window of windows) {
			const startMinutes = parseTimeToMinutes(window.startTime);
			const endMinutes = parseTimeToMinutes(window.endTime);
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
				slots.push({
					date,
					dateKey,
					startMinutes: interval.start,
					endMinutes: interval.end,
				});
			}
		}
	}

	const plannedLearningTimeMinutes = slots.reduce(
		(total, slot) => total + (slot.endMinutes - slot.startMinutes),
		0,
	);
	const remainingMinutes = requestedMinutes - plannedLearningTimeMinutes;
	if (remainingMinutes >= MIN_LEARNING_SLOT_MINUTES) {
		slots.push(
			...buildAlternativeLearningSlots(
				examDateKey,
				availableDays,
				windowsByDay,
				occupiedIntervalsByDay,
				remainingMinutes,
			),
		);
	}

	return slots
		.filter(
			(slot) =>
				slot.endMinutes - slot.startMinutes >= MIN_LEARNING_SLOT_MINUTES,
		)
		.sort(
			(left, right) =>
				left.dateKey.localeCompare(right.dateKey) ||
				left.startMinutes - right.startMinutes,
		);
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

const normalizeSessions = (
	examDateKey: string,
	availableDays: number,
	sessions: z.infer<typeof generatedPlanSchema>["sessions"],
	learningTimes: LearningTimeWindow[],
	occupiedEntries: OccupiedEntry[],
) => {
	const requestedMinutes = sessions.reduce(
		(total, session) => total + session.durationMinutes,
		0,
	);
	const slots = buildLearningSlots(
		examDateKey,
		availableDays,
		learningTimes,
		occupiedEntries,
		requestedMinutes,
	);
	const availableLearningTimeMinutes = slots
		.filter((slot) => !slot.isAlternative)
		.reduce((total, slot) => total + (slot.endMinutes - slot.startMinutes), 0);
	const distributedOffsets = distributeSessionOffsets(availableDays, sessions);
	const prioritizedSessions = sessions
		.map((session, index) => ({
			session,
			preferredDateKey: formatDateKey(
				buildDateFromOffset(examDateKey, distributedOffsets[index] ?? 0),
			),
		}))
		.sort((left, right) =>
			left.preferredDateKey.localeCompare(right.preferredDateKey),
		);

	const normalizedSessions = slots
		.slice(0, MAX_GENERATED_SESSIONS)
		.map((slot, index) => {
			const source =
				prioritizedSessions.find(
					(item) => item.preferredDateKey <= slot.dateKey,
				)?.session ??
				prioritizedSessions[index % Math.max(prioritizedSessions.length, 1)]
					?.session ??
				sessions[index % Math.max(sessions.length, 1)];
			const phase = source?.phase ?? "practice";
			const durationMinutes = slot.endMinutes - slot.startMinutes;
			return {
				phase,
				title:
					compactSingleLine(
						slot.isAlternative
							? `Alternative: ${
									source
										? normalizeAiGeneratedGermanText(source.title)
										: fallbackTitleByPhase[phase]
								}`
							: source
								? normalizeAiGeneratedGermanText(source.title)
								: fallbackTitleByPhase[phase],
						MAX_SESSION_TITLE_CHARS,
					) || fallbackTitleByPhase[phase],
				dateKey: slot.date.toISOString(),
				dateLabel: formatDateLabel(slot.date),
				startTime: formatTimeFromMinutes(slot.startMinutes),
				durationMinutes,
				goal:
					(source ? normalizeAiGeneratedGermanText(source.goal).trim() : "") ||
					"Nutze diese Lernzeit, um dich gezielt auf die Prüfung vorzubereiten.",
				tasks: source?.tasks
					.map((task) => normalizeAiGeneratedGermanText(task).trim())
					.filter(Boolean) ?? [
					"Wiederhole die wichtigsten Begriffe.",
					"Löse eine passende Übungsaufgabe.",
				],
				expectedOutcome:
					(source
						? normalizeAiGeneratedGermanText(source.expectedOutcome).trim()
						: "") ||
					"Du hast einen konkreten Fortschritt für die Prüfung gemacht.",
			};
		})
		.sort((left, right) => left.dateKey.localeCompare(right.dateKey));

	const plannedMinutes = normalizedSessions.reduce(
		(total, session) => total + session.durationMinutes,
		0,
	);
	const totalLearningTimeMinutes = learningTimes.reduce(
		(total, learningTime) => {
			const start = parseTimeToMinutes(learningTime.startTime);
			const end = parseTimeToMinutes(learningTime.endTime);
			return start === null || end === null || end <= start
				? total
				: total + end - start;
		},
		0,
	);
	const busyLearningTimeMinutes = Math.max(
		0,
		totalLearningTimeMinutes - availableLearningTimeMinutes,
	);
	const hasAlternativeSessions = normalizedSessions.some((session) =>
		session.title.startsWith("Alternative:"),
	);
	const availabilityHint =
		learningTimes.length === 0
			? "Keine Lernzeiten hinterlegt."
			: hasAlternativeSessions
				? "Lernzeiten belegt. Alternativen vorgeschlagen."
				: busyLearningTimeMinutes > 0
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

const buildFallbackGeneratedPlan = (
	context: LearningPlanAiContext,
	answers: Array<{ questionId: string; answer: string }>,
): z.infer<typeof generatedPlanSchema> => {
	const answeredCount = answers.filter((answer) => answer.answer.trim()).length;
	return {
		sourceSummary: generatedGermanText(
			"Der Lernplan basiert auf deinen Antworten und den verfügbaren Lernzeiten.",
		),
		insight: {
			summary: generatedGermanText(
				`Du hast ${answeredCount} Antworten gegeben. Daraus wird ein vorsichtiger Grundlagenplan erstellt.`,
			),
			strengths: [],
			gaps: [
				generatedGermanText(
					"Nutze die vorgeschlagenen kurzen Einheiten gezielt zur Wiederholung.",
				),
			],
		},
		sessions: [
			{
				phase: "practice",
				title: generatedGermanText("Kurz üben"),
				dayOffsetBeforeExam: Math.min(
					Math.max(getAvailableDays(context.plan.examDateKey), 1),
					120,
				),
				startTime: "17:00",
				durationMinutes: 30,
				goal: generatedGermanText(
					"Wiederhole die wichtigsten Punkte aus deinen Antworten in einem kurzen Lernblock.",
				),
				tasks: [
					generatedGermanText("Markiere die wichtigsten Begriffe."),
					generatedGermanText("Löse eine kurze passende Übungsaufgabe."),
				],
				expectedOutcome: generatedGermanText(
					"Du hast eine konkrete Wiederholung abgeschlossen.",
				),
			},
		],
	};
};

export const __testOnlyLearningPlanAi = {
	normalizeSessions,
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
		.sort((left, right) => left.dayOfWeek - right.dayOfWeek)
		.map(
			(time) =>
				`${dayLabels[time.dayOfWeek] ?? "Lerntag"} ${time.startTime}-${time.endTime}`,
		)
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
			throwUserFacingError("Beschreibe zuerst das Prüfungsthema.");
		}
		assertMeaningfulTopicDescription(context.plan.topicDescription);

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
Die Fragen müssen sich konkret auf Prüfungsthema und Inhalte aus dem Material beziehen, aber wie normale Prüfungs- oder Verständnisfragen formuliert sein.
Verweise in den Fragen nie direkt auf Quellen oder Uploads: keine Formulierungen wie "laut Material", "im Dokument", "auf dem Bild", "in der Datei", "Material 3 sagt" und keine Dateinamen.
Keine Multiple-Choice-Fragen.
Formuliere alle sichtbaren Texte in korrektem Deutsch mit Umlauten und Sonderzeichen: ä, ö, ü, Ä, Ö, Ü, ß. Verwende keine Ersatzschreibweisen wie ae, oe, ue oder ss, wenn ein Umlaut oder ß gemeint ist.
Für jedes text/asciiShadow-Objekt gilt: text ist die sichtbare Fassung; asciiShadow ist exakt dieselbe Formulierung, nur mit ä->ae, ö->oe, ü->ue, Ä->Ae, Ö->Oe, Ü->Ue und ß->ss.`,
			},
		];

		if (sourceContext) {
			userContent.push({
				type: "text",
				text: `Auszüge aus dem Lernmaterial:\n${sourceContext}`,
			});
		}
		userContent.push(...fileParts);

		const generatedQuestions = await withGeneratedTextRetry(async (attempt) => {
			const result = await withLlmTimeout((abortSignal) =>
				generateText({
					model: model(MODEL_ID),
					temperature: 0.2,
					maxOutputTokens: 2_600,
					abortSignal,
					providerOptions: vertexProviderOptions,
					output: Output.object({ schema: questionsSchema }),
					system: `Du bist ein präziser Lerncoach für Schüler der 10. bis 12. Klasse in Sachsen. Antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`,
					messages: [{ role: "user", content: userContent }],
				}),
			);

			const questions = result.output.questions.map((question, index) => ({
				id: `q${index + 1}`,
				prompt: normalizeAiGeneratedGermanText(question.prompt),
				targetInsight: normalizeAiGeneratedGermanText(question.targetInsight),
			}));

			return {
				questions,
				sourceSummary: normalizeAiGeneratedGermanText(
					result.output.sourceSummary,
				),
			};
		}, "Die Wissensanalyse konnte nicht zuverlässig erstellt werden. Formuliere das Prüfungsthema etwas konkreter und versuche es erneut.");

		await ctx.runMutation(internal.learningPlans.storeKnowledgeQuestions, {
			learningPlanId: args.learningPlanId,
			questions: generatedQuestions.questions,
			sourceSummary: generatedQuestions.sourceSummary,
		});

		return { questionCount: generatedQuestions.questions.length };
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
			throwUserFacingError("Die Wissensanalyse-Fragen fehlen noch.");
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
		const personalLearningTimes = describeLearningTimes(context.learningTimes);
		const model = createVertexModel();
		const userContent: Array<
			| { type: "text"; text: string }
			| { type: "file"; data: Buffer; mediaType: string; filename: string }
		> = [
			{
				type: "text",
				text: `${buildBaseContext(context)}
Verfügbare Tage bis zur Prüfung: ${availableDays}
Persönliche Lernzeiten aus den Einstellungen:
${personalLearningTimes}

Wissensanalyse:
${qaText}

Erstelle einen konkreten Lernplan, der die Antworten sichtbar berücksichtigt.
MVP-Vorgabe:
- Baue, wenn zeitlich möglich, die Phasen Theorie, Üben und Generalprobe.
- Theorie nur bis zur Mindestbeherrschung planen.
- Der größte Block soll die Übungsphase sein.
- Die Generalprobe soll wie ein fertiger Test/Probetest formuliert sein.
- Jeder Lernblock braucht konkrete Aufgaben, die der Schüler in diesem Slot abarbeitet.
- Formuliere alle sichtbaren Texte (sourceSummary, insight, Titel, goal, tasks, expectedOutcome) in korrektem Deutsch mit Umlauten und Sonderzeichen: ä, ö, ü, Ä, Ö, Ü, ß. Verwende keine Ersatzschreibweisen wie ae, oe, ue oder ss, wenn ein Umlaut oder ß gemeint ist.
- Für jedes text/asciiShadow-Objekt gilt: text ist die sichtbare Fassung; asciiShadow ist exakt dieselbe Formulierung, nur mit ä->ae, ö->oe, ü->ue, Ä->Ae, Ö->Oe, Ü->Ue und ß->ss.
- Session-Titel müssen kurze UI-Labels mit maximal ${MAX_SESSION_TITLE_CHARS} Zeichen sein.
- insight.strengths darf maximal 4 Punkte enthalten, insight.gaps maximal 5 Punkte.
- Jeder Lernblock darf maximal 5 Aufgaben enthalten, der gesamte Plan maximal 5 Lernblöcke.
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
			const normalized = normalizeSessions(
				context.plan.examDateKey,
				availableDays,
				output.sessions,
				context.learningTimes,
				context.occupiedEntries,
			);

			return {
				sourceSummary: normalizeAiGeneratedGermanText(output.sourceSummary),
				insight: {
					summary: normalizeAiGeneratedGermanText(output.insight.summary),
					strengths: output.insight.strengths.map((strength) =>
						normalizeAiGeneratedGermanText(strength),
					),
					gaps: output.insight.gaps.map((gap) =>
						normalizeAiGeneratedGermanText(gap),
					),
				},
				sessions: normalized.sessions,
				planningHint: [extraPlanningHint, normalized.planningHint]
					.filter(Boolean)
					.join(" "),
			};
		};

		const planFallbackMessage =
			"Aus diesen Antworten konnte kein stabiler Lernplan erstellt werden. Ergänze mindestens ein paar konkrete Stichworte zu deinem Wissenstand und versuche es erneut.";
		let generatedPlan: ReturnType<typeof normalizeGeneratedPlan>;
		try {
			generatedPlan = await withGeneratedTextRetry(async (attempt) => {
				const result = await withLlmTimeout((abortSignal) =>
					generateText({
						model: model(MODEL_ID),
						temperature: 0.25,
						maxOutputTokens: 4_800,
						abortSignal,
						providerOptions: vertexProviderOptions,
						output: Output.object({ schema: generatedPlanSchema }),
						system: `Du bist ein strenger, praxisnaher Lernplaner. Plane nur realistische, kalendereignete Lernslots und antworte ausschließlich im vorgegebenen JSON-Schema.${generatedTextRetrySystemInstruction(attempt)}`,
						messages: [{ role: "user", content: userContent }],
					}),
				);

				return normalizeGeneratedPlan(result.output);
			}, planFallbackMessage);
		} catch (error) {
			if (getUserFacingBackendErrorMessage(error) !== planFallbackMessage) {
				throw error;
			}

			generatedPlan = normalizeGeneratedPlan(
				buildFallbackGeneratedPlan(context, args.answers),
				"Alternativplan erstellt.",
			);
		}

		await ctx.runMutation(internal.learningPlans.replaceGeneratedSessions, {
			learningPlanId: args.learningPlanId,
			knowledgeAnswersJson: JSON.stringify(args.answers),
			sourceSummary: generatedPlan.sourceSummary,
			insight: generatedPlan.insight,
			planningHint: generatedPlan.planningHint,
			sessions: generatedPlan.sessions,
		});

		return { sessionCount: generatedPlan.sessions.length };
	},
});
