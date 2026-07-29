"use node";

import { createVertex } from "@ai-sdk/google-vertex";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { readOptionalEnv, readRequiredEnv } from "./env";
import {
	getUserFacingBackendErrorMessage,
	logDiagnosticError,
	throwUserFacingError,
} from "./errors";
import { createManagedReadUrl, type StorageProvider } from "./fileStorage";
import {
	MAX_TIMETABLE_FILE_BYTES,
	MAX_TIMETABLE_LESSONS,
	TIMETABLE_DOWNLOAD_TIMEOUT_MS,
} from "./timetablePolicy";

const MODEL_ID =
	readOptionalEnv("GOOGLE_VERTEX_FLASH_MODEL") ?? "gemini-3-flash-preview";

const extractionSchema = z.object({
	lessons: z
		.array(
			z.object({
				dayOfWeek: z.number().int().min(1).max(7),
				subject: z.string().min(1).max(80),
				startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
				endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
				room: z.string().max(40).optional(),
			}),
		)
		.min(1)
		.max(MAX_TIMETABLE_LESSONS),
});

type ExtractionContext = {
	timetableId: Id<"timetables">;
	document: {
		storageId: string;
		storageProvider: StorageProvider;
		fileName: string;
		fileType: string;
		fileSizeBytes: number;
	};
	accessKey: string;
};

const createVertexModel = () => {
	const apiKey = readOptionalEnv("GOOGLE_VERTEX_API_KEY");
	if (apiKey) return createVertex({ apiKey });
	return createVertex({
		project: readRequiredEnv(
			"GOOGLE_VERTEX_PROJECT",
			"Konfiguriere GOOGLE_VERTEX_API_KEY oder GOOGLE_VERTEX_PROJECT + GOOGLE_VERTEX_LOCATION.",
		),
		location: readOptionalEnv("GOOGLE_VERTEX_LOCATION") ?? "global",
	});
};

export const extract = action({
	args: {
		timetableId: v.id("timetables"),
	},
	handler: async (ctx, args): Promise<{ lessonCount: number }> => {
		const context: ExtractionContext = await ctx.runQuery(
			internal.timetables.getExtractionContext,
			{ timetableId: args.timetableId },
		);
		await ctx.runMutation(internal.timetables.setProcessingStatus, {
			timetableId: context.timetableId,
			status: "processing",
		});

		try {
			if (context.document.fileSizeBytes > MAX_TIMETABLE_FILE_BYTES) {
				throwUserFacingError("Die Datei ist zu groß (maximal 7 MiB).");
			}
			const downloadUrl = await createManagedReadUrl(
				ctx,
				{
					storageId: context.document.storageId,
					storageProvider: context.document.storageProvider,
				},
				context.accessKey,
				{
					fileName: context.document.fileName,
					userFacingMessage:
						"Der Stundenplan konnte nicht gelesen werden. Lade ihn bitte erneut hoch.",
				},
			);
			const response = await fetch(downloadUrl, {
				signal: AbortSignal.timeout(TIMETABLE_DOWNLOAD_TIMEOUT_MS),
			});
			if (!response.ok) {
				throw new Error(
					`Timetable download failed: ${response.status} ${response.statusText}`,
				);
			}
			const contentLength = Number(response.headers.get("content-length"));
			if (
				Number.isFinite(contentLength) &&
				contentLength > MAX_TIMETABLE_FILE_BYTES
			) {
				throwUserFacingError("Die Datei ist zu groß (maximal 7 MiB).");
			}
			const bytes = await response.arrayBuffer();
			if (bytes.byteLength > MAX_TIMETABLE_FILE_BYTES) {
				throwUserFacingError("Die Datei ist zu groß (maximal 7 MiB).");
			}

			const result = await generateText({
				model: createVertexModel()(MODEL_ID),
				temperature: 0,
				maxOutputTokens: 5_000,
				output: Output.object({ schema: extractionSchema }),
				system:
					"Du liest deutsche Schulstundenpläne. Extrahiere ausschließlich eindeutig erkennbare Unterrichtsstunden. dayOfWeek ist 1=Montag bis 7=Sonntag. Verwende 24-Stunden-Uhrzeiten im Format HH:MM. Pausen, Freistunden, Überschriften, Lehrer und Legenden sind keine Unterrichtsstunden. Erfinde keine Fächer oder Uhrzeiten. Raum ist optional. Antworte ausschließlich im vorgegebenen JSON-Schema.",
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Extrahiere alle erkennbaren Unterrichtsstunden aus diesem Stundenplan. Doppelstunden bleiben einzelne Zeitintervalle, wenn sie im Plan als zusammenhängender Block dargestellt sind.",
							},
							{
								type: "file",
								data: Buffer.from(bytes),
								mediaType:
									context.document.fileType || "application/octet-stream",
								filename: context.document.fileName,
							},
						],
					},
				],
			});
			await ctx.runMutation(internal.timetables.storeExtractedLessons, {
				timetableId: context.timetableId,
				lessons: result.output.lessons,
			});
			return { lessonCount: result.output.lessons.length };
		} catch (error) {
			logDiagnosticError("timetableAi.extract", error, {
				timetableId: context.timetableId,
				fileName: context.document.fileName,
			});
			const userFacingMessage = getUserFacingBackendErrorMessage(error);
			const message =
				userFacingMessage ??
				(NoObjectGeneratedError.isInstance(error)
					? "Wir konnten keine Unterrichtsstunden sicher erkennen. Du kannst sie manuell ergänzen."
					: "Der Stundenplan konnte nicht automatisch gelesen werden. Du kannst es erneut versuchen oder die Stunden manuell ergänzen.");
			await ctx.runMutation(internal.timetables.setProcessingStatus, {
				timetableId: context.timetableId,
				status: "failed",
				errorMessage: message,
			});
			if (userFacingMessage) throw error;
			throwUserFacingError(message);
		}
	},
});
