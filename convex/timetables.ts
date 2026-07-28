import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { throwUserFacingError } from "./errors";
import {
	getConfiguredStorageProvider,
	getR2ConfigOrThrow,
} from "./fileStorage";
import { timetableTimeToMinutes } from "./timetableOccurrences";

const timetableStatusValidator = v.union(
	v.literal("draft"),
	v.literal("processing"),
	v.literal("review"),
	v.literal("active"),
	v.literal("failed"),
	v.literal("archived"),
);

export const timetableLessonInputValidator = v.object({
	dayOfWeek: v.number(),
	subject: v.string(),
	startTime: v.string(),
	endTime: v.string(),
	room: v.optional(v.string()),
});

export type TimetableLessonInput = {
	dayOfWeek: number;
	subject: string;
	startTime: string;
	endTime: string;
	room?: string;
};

const MAX_TIMETABLE_LESSONS = 150;

const requireOwnerTokenIdentifier = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throwUserFacingError("Nicht authentifiziert.");
	}
	return identity.tokenIdentifier;
};

const buildTimetableAccessKey = (timetableId: Id<"timetables">) =>
	`timetable:${timetableId}`;

const publicTimetable = (timetable: Doc<"timetables">) => ({
	id: timetable._id,
	title: timetable.title,
	status: timetable.status,
	errorMessage: timetable.errorMessage ?? null,
	activatedAt: timetable.activatedAt ?? null,
	updatedAt: timetable.updatedAt,
});

const publicLesson = (lesson: Doc<"timetableLessons">) => ({
	id: lesson._id,
	dayOfWeek: lesson.dayOfWeek,
	subject: lesson.subject,
	startTime: lesson.startTime,
	endTime: lesson.endTime,
	room: lesson.room ?? null,
});

const getTimetableLessons = async (
	ctx: QueryCtx,
	timetableId: Id<"timetables">,
) =>
	await ctx.db
		.query("timetableLessons")
		.withIndex("by_timetableId_and_dayOfWeek_and_startTime", (q) =>
			q.eq("timetableId", timetableId),
		)
		.take(MAX_TIMETABLE_LESSONS);

export const getMine = query({
	args: {},
	handler: async (ctx) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const timetables = await ctx.db
			.query("timetables")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.order("desc")
			.take(20);
		const active = timetables.find((item) => item.status === "active") ?? null;
		const draft =
			timetables.find((item) =>
				["draft", "processing", "review", "failed"].includes(item.status),
			) ?? null;

		return {
			active: active
				? {
						...publicTimetable(active),
						lessons: (await getTimetableLessons(ctx, active._id)).map(
							publicLesson,
						),
					}
				: null,
			draft: draft
				? {
						...publicTimetable(draft),
						lessons: (await getTimetableLessons(ctx, draft._id)).map(
							publicLesson,
						),
					}
				: null,
		};
	},
});

export const createDraft = mutation({
	args: {},
	handler: async (ctx) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const existingDrafts = await ctx.db
			.query("timetables")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.order("desc")
			.take(20);
		const existingDraft = existingDrafts.find((item) =>
			["draft", "processing", "review", "failed"].includes(item.status),
		);
		if (existingDraft) return existingDraft._id;

		const now = Date.now();
		return await ctx.db.insert("timetables", {
			ownerTokenIdentifier,
			title: "Mein Stundenplan",
			status: "draft",
			createdAt: now,
			updatedAt: now,
		});
	},
});

const normalizeAndValidateLessons = (lessons: TimetableLessonInput[]) => {
	if (lessons.length === 0) {
		throwUserFacingError("Füge mindestens eine Unterrichtsstunde hinzu.");
	}
	if (lessons.length > MAX_TIMETABLE_LESSONS) {
		throwUserFacingError(
			"Der Stundenplan enthält zu viele Unterrichtsstunden.",
		);
	}

	const normalized = lessons.map((lesson) => {
		const subject = lesson.subject.trim();
		const room = lesson.room?.trim();
		const start = timetableTimeToMinutes(lesson.startTime);
		const end = timetableTimeToMinutes(lesson.endTime);
		if (
			!Number.isInteger(lesson.dayOfWeek) ||
			lesson.dayOfWeek < 1 ||
			lesson.dayOfWeek > 7
		) {
			throwUserFacingError(
				"Wähle für jede Unterrichtsstunde einen gültigen Wochentag.",
			);
		}
		if (!subject) {
			throwUserFacingError("Gib für jede Unterrichtsstunde ein Fach an.");
		}
		if (start === null || end === null || end <= start) {
			throwUserFacingError(
				`Prüfe die Uhrzeit für ${subject}. Die Endzeit muss nach der Startzeit liegen.`,
			);
		}
		return {
			dayOfWeek: lesson.dayOfWeek,
			subject,
			startTime: lesson.startTime,
			endTime: lesson.endTime,
			...(room ? { room } : {}),
			start,
			end,
		};
	});

	const sorted = [...normalized].sort(
		(left, right) =>
			left.dayOfWeek - right.dayOfWeek || left.start - right.start,
	);
	for (let index = 1; index < sorted.length; index += 1) {
		const previous = sorted[index - 1];
		const current = sorted[index];
		if (
			previous &&
			current &&
			previous.dayOfWeek === current.dayOfWeek &&
			previous.end > current.start
		) {
			throwUserFacingError(
				`${previous.subject} und ${current.subject} überschneiden sich.`,
			);
		}
	}

	return sorted.map(({ start: _start, end: _end, ...lesson }) => lesson);
};

const replaceLessons = async (
	ctx: MutationCtx,
	{
		timetable,
		lessons,
	}: {
		timetable: Doc<"timetables">;
		lessons: TimetableLessonInput[];
	},
) => {
	const normalizedLessons = normalizeAndValidateLessons(lessons);
	const existing = await ctx.db
		.query("timetableLessons")
		.withIndex("by_timetableId_and_dayOfWeek_and_startTime", (q) =>
			q.eq("timetableId", timetable._id),
		)
		.take(MAX_TIMETABLE_LESSONS);
	for (const lesson of existing) {
		await ctx.db.delete("timetableLessons", lesson._id);
	}

	const now = Date.now();
	for (const [sortOrder, lesson] of normalizedLessons.entries()) {
		await ctx.db.insert("timetableLessons", {
			ownerTokenIdentifier: timetable.ownerTokenIdentifier,
			timetableId: timetable._id,
			...lesson,
			sortOrder,
			createdAt: now,
			updatedAt: now,
		});
	}
};

export const saveAndActivate = mutation({
	args: {
		timetableId: v.id("timetables"),
		lessons: v.array(timetableLessonInputValidator),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const timetable = await ctx.db.get("timetables", args.timetableId);
		if (!timetable || timetable.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Stundenplan nicht gefunden.");
		}

		await replaceLessons(ctx, { timetable, lessons: args.lessons });
		const activeTimetables = await ctx.db
			.query("timetables")
			.withIndex("by_ownerTokenIdentifier_and_status", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("status", "active"),
			)
			.take(10);
		const now = Date.now();
		for (const active of activeTimetables) {
			if (active._id !== timetable._id) {
				await ctx.db.patch("timetables", active._id, {
					status: "archived",
					updatedAt: now,
				});
			}
		}
		await ctx.db.patch("timetables", timetable._id, {
			status: "active",
			errorMessage: undefined,
			activatedAt: now,
			updatedAt: now,
		});
		return timetable._id;
	},
});

export const generateUploadUrl = mutation({
	args: {
		timetableId: v.id("timetables"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const timetable = await ctx.db.get("timetables", args.timetableId);
		if (!timetable || timetable.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Stundenplan nicht gefunden.");
		}

		const storageProvider = getConfiguredStorageProvider();
		return await ctx.runMutation(
			components.convexFilesControl.upload.generateUploadUrl,
			{
				provider: storageProvider,
				...(storageProvider === "r2" ? { r2Config: getR2ConfigOrThrow() } : {}),
			},
		);
	},
});

export const getUploadRegistrationContext = internalQuery({
	args: {
		timetableId: v.id("timetables"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const timetable = await ctx.db.get("timetables", args.timetableId);
		if (!timetable || timetable.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Stundenplan nicht gefunden.");
		}
		return {
			ownerTokenIdentifier,
			accessKey: buildTimetableAccessKey(timetable._id),
		};
	},
});

export const storeUploadedDocument = internalMutation({
	args: {
		ownerTokenIdentifier: v.string(),
		timetableId: v.id("timetables"),
		storageId: v.string(),
		storageProvider: v.union(v.literal("convex"), v.literal("r2")),
		fileName: v.string(),
		fileType: v.string(),
		fileSizeBytes: v.number(),
	},
	handler: async (ctx, args) =>
		await ctx.db.insert("timetableDocuments", {
			...args,
			createdAt: Date.now(),
		}),
});

export const registerUploadedDocument = action({
	args: {
		timetableId: v.id("timetables"),
		uploadToken: v.string(),
		storageId: v.string(),
		fileName: v.string(),
		fileType: v.string(),
		fileSizeBytes: v.number(),
	},
	handler: async (ctx, args): Promise<Id<"timetableDocuments">> => {
		const context: {
			ownerTokenIdentifier: string;
			accessKey: string;
		} = await ctx.runQuery(internal.timetables.getUploadRegistrationContext, {
			timetableId: args.timetableId,
		});
		const finalizedUpload = await ctx.runMutation(
			components.convexFilesControl.upload.finalizeUpload,
			{
				uploadToken: args.uploadToken,
				storageId: args.storageId,
				accessKeys: [context.accessKey],
			},
		);
		if (finalizedUpload.storageId !== args.storageId) {
			throwUserFacingError("Upload konnte nicht verifiziert werden.");
		}

		return await ctx.runMutation(internal.timetables.storeUploadedDocument, {
			ownerTokenIdentifier: context.ownerTokenIdentifier,
			timetableId: args.timetableId,
			storageId: args.storageId,
			storageProvider: finalizedUpload.storageProvider,
			fileName: args.fileName,
			fileType: args.fileType || "application/octet-stream",
			fileSizeBytes: finalizedUpload.metadata?.size ?? args.fileSizeBytes,
		});
	},
});

export const getExtractionContext = internalQuery({
	args: {
		timetableId: v.id("timetables"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const timetable = await ctx.db.get("timetables", args.timetableId);
		if (!timetable || timetable.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Stundenplan nicht gefunden.");
		}
		const documents = await ctx.db
			.query("timetableDocuments")
			.withIndex("by_timetableId", (q) => q.eq("timetableId", timetable._id))
			.order("desc")
			.take(1);
		const document = documents[0];
		if (!document) {
			throwUserFacingError(
				"Lade zuerst ein Bild oder PDF deines Stundenplans hoch.",
			);
		}
		return {
			timetableId: timetable._id,
			document: {
				storageId: document.storageId,
				storageProvider: document.storageProvider,
				fileName: document.fileName,
				fileType: document.fileType,
				fileSizeBytes: document.fileSizeBytes,
			},
			accessKey: buildTimetableAccessKey(timetable._id),
		};
	},
});

export const setProcessingStatus = internalMutation({
	args: {
		timetableId: v.id("timetables"),
		status: timetableStatusValidator,
		errorMessage: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const timetable = await ctx.db.get("timetables", args.timetableId);
		if (!timetable) return null;
		await ctx.db.patch("timetables", timetable._id, {
			status: args.status,
			errorMessage: args.errorMessage,
			updatedAt: Date.now(),
		});
		return timetable._id;
	},
});

export const storeExtractedLessons = internalMutation({
	args: {
		timetableId: v.id("timetables"),
		lessons: v.array(timetableLessonInputValidator),
	},
	handler: async (ctx, args) => {
		const timetable = await ctx.db.get("timetables", args.timetableId);
		if (!timetable) return null;
		await replaceLessons(ctx, { timetable, lessons: args.lessons });
		await ctx.db.patch("timetables", timetable._id, {
			status: "review",
			errorMessage: undefined,
			updatedAt: Date.now(),
		});
		return timetable._id;
	},
});
