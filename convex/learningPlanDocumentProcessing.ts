import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import {
	buildLearningPlanChunkSearchQuery,
	LEARNING_PLAN_DOCUMENT_CHUNK_CHARS,
	LEARNING_PLAN_DOCUMENT_MAX_CHUNKS,
	type LearningPlanDocumentChunk,
} from "./learningPlanDocumentContext";

export const DOCUMENT_PROCESSING_VERSION = 2;
export const STALE_DOCUMENT_PROCESSING_MS = 11 * 60_000;

const processedChunkValidator = v.object({
	chunkIndex: v.number(),
	charStart: v.number(),
	charEnd: v.number(),
	text: v.string(),
});

const processingResultValidator = v.union(
	v.object({
		status: v.literal("ready"),
	}),
	v.object({ status: v.literal("processing") }),
	v.object({ status: v.literal("failed"), errorMessage: v.string() }),
	v.object({
		status: v.literal("claimed"),
		document: v.object({
			id: v.id("learningPlanDocuments"),
			learningPlanId: v.id("learningPlans"),
			storageId: v.string(),
			storageProvider: v.union(v.literal("convex"), v.literal("r2")),
			fileName: v.string(),
			fileType: v.string(),
			fileSizeBytes: v.number(),
			sourceKind: v.union(v.literal("school"), v.literal("external")),
		}),
	}),
);

export const claim = internalMutation({
	args: {
		documentId: v.id("learningPlanDocuments"),
		claimId: v.string(),
		processingVersion: v.number(),
		retryFailed: v.optional(v.boolean()),
	},
	returns: processingResultValidator,
	handler: async (ctx, args) => {
		const document = await ctx.db.get("learningPlanDocuments", args.documentId);
		if (!document) {
			return {
				status: "failed" as const,
				errorMessage: "Dokument nicht gefunden.",
			};
		}
		const existing = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
			.unique();
		const now = Date.now();
		if (
			existing?.status === "ready" &&
			existing.processingVersion === args.processingVersion &&
			existing.chunkCount !== undefined
		) {
			const firstChunk = await ctx.db
				.query("learningPlanDocumentChunks")
				.withIndex("by_contextId_and_chunkIndex", (q) =>
					q.eq("contextId", existing._id),
				)
				.order("asc")
				.first();
			if (firstChunk) return { status: "ready" as const };
		}
		if (
			existing?.status === "processing" &&
			existing.processingVersion === args.processingVersion &&
			now - existing.updatedAt < STALE_DOCUMENT_PROCESSING_MS
		) {
			return { status: "processing" as const };
		}
		if (
			existing?.status === "failed" &&
			existing.processingVersion === args.processingVersion &&
			!args.retryFailed
		) {
			return {
				status: "failed" as const,
				errorMessage:
					existing.errorMessage ??
					"Das Dokument konnte nicht verarbeitet werden.",
			};
		}

		const nextContext = {
			ownerTokenIdentifier: document.ownerTokenIdentifier,
			learningPlanId: document.learningPlanId,
			documentId: document._id,
			processingVersion: args.processingVersion,
			status: "processing" as const,
			claimId: args.claimId,
			sourceFileSizeBytes: document.fileSizeBytes,
			normalizedText: undefined,
			chunkCount: undefined,
			totalTextChars: undefined,
			extractionMethod: undefined,
			sourceChecksum: undefined,
			errorMessage: undefined,
			processedAt: undefined,
			updatedAt: now,
		};
		if (existing) {
			await ctx.db.patch(
				"learningPlanDocumentContexts",
				existing._id,
				nextContext,
			);
		} else {
			await ctx.db.insert("learningPlanDocumentContexts", {
				...nextContext,
				createdAt: now,
			});
		}
		await ctx.db.patch("learningPlanDocuments", document._id, {
			processingStatus: "processing",
			processingVersion: args.processingVersion,
			processingError: undefined,
		});

		return {
			status: "claimed" as const,
			document: {
				id: document._id,
				learningPlanId: document.learningPlanId,
				storageId: document.storageId,
				storageProvider: document.storageProvider,
				fileName: document.fileName,
				fileType: document.fileType,
				fileSizeBytes: document.fileSizeBytes,
				sourceKind: document.sourceKind ?? "school",
			},
		};
	},
});

export const authorize = internalQuery({
	args: { documentId: v.id("learningPlanDocuments") },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return false;
		const document = await ctx.db.get("learningPlanDocuments", args.documentId);
		return document?.ownerTokenIdentifier === identity.tokenIdentifier;
	},
});

export const getRelevantChunks = internalQuery({
	args: {
		learningPlanId: v.id("learningPlans"),
		documentIds: v.array(v.id("learningPlanDocuments")),
		selectionQuery: v.string(),
	},
	returns: v.array(
		v.object({
			documentId: v.id("learningPlanDocuments"),
			chunkIndex: v.number(),
			charStart: v.number(),
			charEnd: v.number(),
			text: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const documentIds = [...new Set(args.documentIds)];
		const selected: Doc<"learningPlanDocumentChunks">[] = [];
		const perDocumentLimit = Math.max(
			1,
			Math.floor(12 / Math.max(1, documentIds.length)),
		);
		for (const documentId of documentIds) {
			const context = await ctx.db
				.query("learningPlanDocumentContexts")
				.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
				.unique();
			if (
				context?.status !== "ready" ||
				context.learningPlanId !== args.learningPlanId
			)
				continue;
			const relevant = await ctx.db
				.query("learningPlanDocumentChunks")
				.withSearchIndex("search_text", (q) =>
					q
						.search(
							"text",
							buildLearningPlanChunkSearchQuery(args.selectionQuery),
						)
						.eq("learningPlanId", args.learningPlanId)
						.eq("documentId", documentId),
				)
				.take(perDocumentLimit);
			selected.push(
				...relevant.filter(
					(chunk) => chunk.processingVersion === context.processingVersion,
				),
			);
			const first = await ctx.db
				.query("learningPlanDocumentChunks")
				.withIndex("by_contextId_and_chunkIndex", (q) =>
					q.eq("contextId", context._id),
				)
				.first();
			if (
				first &&
				first.processingVersion === context.processingVersion &&
				!selected.some((chunk) => chunk._id === first._id)
			)
				selected.push(first);
		}
		return selected.map(
			({ documentId, chunkIndex, charStart, charEnd, text }) => ({
				documentId,
				chunkIndex,
				charStart,
				charEnd,
				text,
			}),
		);
	},
});

const DOCUMENT_CHUNK_DELETE_BATCH_SIZE = 40;

export const clearChunksForClaim = internalMutation({
	args: {
		documentId: v.id("learningPlanDocuments"),
		claimId: v.string(),
		processingVersion: v.number(),
	},
	returns: v.object({ accepted: v.boolean(), complete: v.boolean() }),
	handler: async (ctx, args) => {
		const context = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
			.unique();
		if (
			!context ||
			context.claimId !== args.claimId ||
			context.processingVersion !== args.processingVersion
		) {
			return { accepted: false, complete: true };
		}
		const chunks = await ctx.db
			.query("learningPlanDocumentChunks")
			.withIndex("by_contextId_and_chunkIndex", (q) =>
				q.eq("contextId", context._id),
			)
			.take(DOCUMENT_CHUNK_DELETE_BATCH_SIZE);
		for (const chunk of chunks) {
			await ctx.db.delete("learningPlanDocumentChunks", chunk._id);
		}
		return {
			accepted: true,
			complete: chunks.length < DOCUMENT_CHUNK_DELETE_BATCH_SIZE,
		};
	},
});

export const DOCUMENT_CHUNK_WRITE_BATCH_SIZE = 40;

const persistChunkBatch = async (
	ctx: MutationCtx,
	context: Doc<"learningPlanDocumentContexts">,
	chunks: LearningPlanDocumentChunk[],
) => {
	const previousCount = context.chunkCount ?? 0;
	if (
		chunks.length > DOCUMENT_CHUNK_WRITE_BATCH_SIZE ||
		previousCount + chunks.length > LEARNING_PLAN_DOCUMENT_MAX_CHUNKS
	)
		throw new Error("Document chunk batch exceeds its limit.");
	for (const [index, chunk] of chunks.entries()) {
		if (
			chunk.chunkIndex !== previousCount + index ||
			chunk.text.length > LEARNING_PLAN_DOCUMENT_CHUNK_CHARS
		)
			throw new Error("Invalid document chunk sequence or size.");
		await ctx.db.insert("learningPlanDocumentChunks", {
			ownerTokenIdentifier: context.ownerTokenIdentifier,
			learningPlanId: context.learningPlanId,
			documentId: context.documentId,
			contextId: context._id,
			processingVersion: context.processingVersion,
			...chunk,
			createdAt: Date.now(),
		});
	}
	return previousCount + chunks.length;
};

export const appendChunks = internalMutation({
	args: {
		documentId: v.id("learningPlanDocuments"),
		claimId: v.string(),
		processingVersion: v.number(),
		chunks: v.array(processedChunkValidator),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const context = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
			.unique();
		if (
			!context ||
			context.status !== "processing" ||
			context.claimId !== args.claimId ||
			context.processingVersion !== args.processingVersion
		)
			return false;
		const chunkCount = await persistChunkBatch(ctx, context, args.chunks);
		await ctx.db.patch("learningPlanDocumentContexts", context._id, {
			chunkCount,
			updatedAt: Date.now(),
		});
		return true;
	},
});

export const complete = internalMutation({
	args: {
		documentId: v.id("learningPlanDocuments"),
		claimId: v.string(),
		processingVersion: v.number(),
		chunks: v.array(processedChunkValidator),
		totalTextChars: v.number(),
		extractionMethod: v.union(v.literal("local"), v.literal("vision")),
		sourceChecksum: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const context = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
			.unique();
		if (
			!context ||
			context.claimId !== args.claimId ||
			context.processingVersion !== args.processingVersion
		)
			return false;
		const now = Date.now();
		const chunkCount = await persistChunkBatch(ctx, context, args.chunks);
		await ctx.db.patch("learningPlanDocumentContexts", context._id, {
			status: "ready",
			claimId: undefined,
			normalizedText: undefined,
			chunkCount,
			totalTextChars: args.totalTextChars,
			extractionMethod: args.extractionMethod,
			sourceChecksum: args.sourceChecksum,
			errorMessage: undefined,
			processedAt: now,
			updatedAt: now,
		});
		await ctx.db.patch("learningPlanDocuments", args.documentId, {
			processingStatus: "ready",
			processingVersion: args.processingVersion,
			processingError: undefined,
		});
		return true;
	},
});

export const fail = internalMutation({
	args: {
		documentId: v.id("learningPlanDocuments"),
		claimId: v.string(),
		processingVersion: v.number(),
		errorMessage: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const context = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
			.unique();
		if (
			!context ||
			context.claimId !== args.claimId ||
			context.processingVersion !== args.processingVersion
		)
			return false;
		await ctx.db.patch("learningPlanDocumentContexts", context._id, {
			status: "failed",
			claimId: undefined,
			errorMessage: args.errorMessage,
			updatedAt: Date.now(),
		});
		await ctx.db.patch("learningPlanDocuments", args.documentId, {
			processingStatus: "failed",
			processingVersion: args.processingVersion,
			processingError: args.errorMessage,
		});
		return true;
	},
});

export const removeByPlan = internalMutation({
	args: { learningPlanId: v.id("learningPlans") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const chunks = await ctx.db
			.query("learningPlanDocumentChunks")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(DOCUMENT_CHUNK_DELETE_BATCH_SIZE);
		for (const chunk of chunks) {
			await ctx.db.delete("learningPlanDocumentChunks", chunk._id);
		}
		if (chunks.length === DOCUMENT_CHUNK_DELETE_BATCH_SIZE) {
			await ctx.scheduler.runAfter(
				0,
				internal.learningPlanDocumentProcessing.removeByPlan,
				{ learningPlanId: args.learningPlanId },
			);
			return null;
		}

		const contexts = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(20);
		for (const context of contexts) {
			await ctx.db.delete("learningPlanDocumentContexts", context._id);
		}
		if (contexts.length === 20) {
			await ctx.scheduler.runAfter(
				0,
				internal.learningPlanDocumentProcessing.removeByPlan,
				{ learningPlanId: args.learningPlanId },
			);
		}
		return null;
	},
});

export const removeByDocument = internalMutation({
	args: { documentId: v.id("learningPlanDocuments") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const chunks = await ctx.db
			.query("learningPlanDocumentChunks")
			.withIndex("by_documentId_and_chunkIndex", (q) =>
				q.eq("documentId", args.documentId),
			)
			.take(DOCUMENT_CHUNK_DELETE_BATCH_SIZE);
		for (const chunk of chunks) {
			await ctx.db.delete("learningPlanDocumentChunks", chunk._id);
		}
		if (chunks.length === DOCUMENT_CHUNK_DELETE_BATCH_SIZE) {
			await ctx.scheduler.runAfter(
				0,
				internal.learningPlanDocumentProcessing.removeByDocument,
				{ documentId: args.documentId },
			);
			return null;
		}

		const context = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
			.unique();
		if (context) {
			await ctx.db.delete("learningPlanDocumentContexts", context._id);
		}
		return null;
	},
});
