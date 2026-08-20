import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const DOCUMENT_PROCESSING_VERSION = 1;
export const STALE_DOCUMENT_PROCESSING_MS = 11 * 60_000;

const processingResultValidator = v.union(
	v.object({ status: v.literal("ready"), normalizedText: v.string() }),
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
			existing.normalizedText !== undefined
		) {
			return {
				status: "ready" as const,
				normalizedText: existing.normalizedText,
			};
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

export const complete = internalMutation({
	args: {
		documentId: v.id("learningPlanDocuments"),
		claimId: v.string(),
		processingVersion: v.number(),
		normalizedText: v.string(),
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
		await ctx.db.patch("learningPlanDocumentContexts", context._id, {
			status: "ready",
			claimId: undefined,
			normalizedText: args.normalizedText,
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
