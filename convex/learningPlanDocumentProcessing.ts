import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { buildLearningPlanChunkSearchQuery } from "./learningPlanDocumentContext";

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
		const allowedDocumentIds = new Set<string>(args.documentIds);
		const relevant = await ctx.db
			.query("learningPlanDocumentChunks")
			.withSearchIndex("search_text", (q) =>
				q
					.search(
						"text",
						buildLearningPlanChunkSearchQuery(args.selectionQuery),
					)
					.eq("learningPlanId", args.learningPlanId),
			)
			.take(12);
		const selected = relevant.filter((chunk) =>
			allowedDocumentIds.has(chunk.documentId),
		);
		const selectedKeys = new Set(
			selected.map((chunk) => `${chunk.documentId}:${chunk.chunkIndex}`),
		);
		for (const documentId of args.documentIds) {
			const first = await ctx.db
				.query("learningPlanDocumentChunks")
				.withIndex("by_documentId_and_chunkIndex", (q) =>
					q.eq("documentId", documentId),
				)
				.order("asc")
				.first();
			if (first && !selectedKeys.has(`${documentId}:${first.chunkIndex}`)) {
				selected.push(first);
			}
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
		for (const chunk of args.chunks) {
			await ctx.db.insert("learningPlanDocumentChunks", {
				ownerTokenIdentifier: context.ownerTokenIdentifier,
				learningPlanId: context.learningPlanId,
				documentId: args.documentId,
				contextId: context._id,
				processingVersion: args.processingVersion,
				...chunk,
				createdAt: now,
			});
		}
		await ctx.db.patch("learningPlanDocumentContexts", context._id, {
			status: "ready",
			claimId: undefined,
			normalizedText: undefined,
			chunkCount: args.chunks.length,
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
