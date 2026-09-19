import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const STALE_GENERATION_ATTEMPT_MS = 11 * 60_000;

const operationValidator = v.union(
	v.literal("document_ingestion"),
	v.literal("diagnostic"),
	v.literal("plan"),
	v.literal("session_content"),
	v.literal("session_retry"),
);

const environmentValidator = v.union(
	v.literal("development"),
	v.literal("production"),
	v.literal("unknown"),
);

const startResultValidator = v.union(
	v.object({ started: v.literal(true) }),
	v.object({ started: v.literal(false), activeAttemptId: v.string() }),
);

type TransferOperation =
	| "document_ingestion"
	| "diagnostic"
	| "plan"
	| "session_content"
	| "session_retry";

const startAttempt = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		learningPlanId: Id<"learningPlans">;
		attemptId: string;
		parentAttemptId?: string;
		documentId?: Id<"learningPlanDocuments">;
		dedupeKey: string;
		operation: TransferOperation;
		environment: "development" | "production" | "unknown";
	},
) => {
	const existingAttempt = await ctx.db
		.query("learningPlanAiTransferAttempts")
		.withIndex("by_attemptId", (q) => q.eq("attemptId", args.attemptId))
		.unique();
	if (existingAttempt) return { started: true as const };

	const active = await ctx.db
		.query("learningPlanAiTransferAttempts")
		.withIndex(
			"by_learningPlanId_and_operation_and_dedupeKey_and_status",
			(q) =>
				q
					.eq("learningPlanId", args.learningPlanId)
					.eq("operation", args.operation)
					.eq("dedupeKey", args.dedupeKey)
					.eq("status", "running"),
		)
		.order("desc")
		.first();
	const now = Date.now();
	if (
		active &&
		now - (active.startedAt ?? active.createdAt) < STALE_GENERATION_ATTEMPT_MS
	) {
		await ctx.db.patch("learningPlanAiTransferAttempts", active._id, {
			duplicateStartCount: (active.duplicateStartCount ?? 0) + 1,
		});
		return { started: false as const, activeAttemptId: active.attemptId };
	}
	if (active) {
		await ctx.db.patch("learningPlanAiTransferAttempts", active._id, {
			status: "failed",
			errorCode: "stale_attempt_recovered",
			completedAt: now,
		});
	}

	await ctx.db.insert("learningPlanAiTransferAttempts", {
		ownerTokenIdentifier: args.ownerTokenIdentifier,
		learningPlanId: args.learningPlanId,
		attemptId: args.attemptId,
		...(args.parentAttemptId ? { parentAttemptId: args.parentAttemptId } : {}),
		...(args.documentId ? { documentId: args.documentId } : {}),
		dedupeKey: args.dedupeKey,
		operation: args.operation,
		environment: args.environment,
		status: "running",
		processingVersion: 0,
		sourceDocumentCount: 0,
		sourceBytes: 0,
		reusedDocumentCount: 0,
		sourceFileReadCount: 0,
		rawFilePartCount: 0,
		rawFilePartBytes: 0,
		compactContextBytes: 0,
		selectedChunkCount: 0,
		selectedChunkBytes: 0,
		providerContextMode:
			args.operation === "document_ingestion"
				? "one_time_ingestion"
				: "persisted_chunks",
		providerReferenceCacheStatus: "not_applicable",
		modelRequestCount: 0,
		structuredRetryCount: 0,
		sessionContentBatchCount: 0,
		duplicateStartCount: 0,
		startedAt: now,
		createdAt: now,
	});
	return { started: true as const };
};

export const start = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		attemptId: v.string(),
		dedupeKey: v.string(),
		operation: operationValidator,
		environment: environmentValidator,
	},
	returns: startResultValidator,
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		return await startAttempt(ctx, {
			...args,
			ownerTokenIdentifier: plan.ownerTokenIdentifier,
		});
	},
});

export const startDocumentIngestion = internalMutation({
	args: {
		documentId: v.id("learningPlanDocuments"),
		attemptId: v.string(),
		parentAttemptId: v.optional(v.string()),
		processingVersion: v.number(),
		environment: environmentValidator,
	},
	returns: startResultValidator,
	handler: async (ctx, args) => {
		const document = await ctx.db.get("learningPlanDocuments", args.documentId);
		if (!document)
			throw new Error("Document not found for ingestion telemetry.");
		if (args.parentAttemptId) {
			const parentAttemptId = args.parentAttemptId;
			const parentAttempt = await ctx.db
				.query("learningPlanAiTransferAttempts")
				.withIndex("by_attemptId", (q) => q.eq("attemptId", parentAttemptId))
				.unique();
			if (
				!parentAttempt ||
				parentAttempt.learningPlanId !== document.learningPlanId ||
				parentAttempt.operation === "document_ingestion"
			) {
				throw new Error("Invalid parent generation attempt for ingestion.");
			}
		}
		return await startAttempt(ctx, {
			ownerTokenIdentifier: document.ownerTokenIdentifier,
			learningPlanId: document.learningPlanId,
			attemptId: args.attemptId,
			parentAttemptId: args.parentAttemptId,
			documentId: args.documentId,
			dedupeKey: `document:${args.documentId}:v${args.processingVersion}`,
			operation: "document_ingestion",
			environment: args.environment,
		});
	},
});

export const recordTransfer = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		attemptId: v.string(),
		processingVersion: v.number(),
		sourceDocumentCount: v.number(),
		sourceBytes: v.number(),
		reusedDocumentCount: v.number(),
		sourceFileReadCount: v.number(),
		rawFilePartCount: v.number(),
		rawFilePartBytes: v.number(),
		compactContextBytes: v.number(),
		selectedChunkCount: v.number(),
		selectedChunkBytes: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const attempt = await ctx.db
			.query("learningPlanAiTransferAttempts")
			.withIndex("by_attemptId", (q) => q.eq("attemptId", args.attemptId))
			.unique();
		if (!attempt || attempt.learningPlanId !== args.learningPlanId) {
			throw new Error("Generation attempt not found for transfer telemetry.");
		}
		await ctx.db.patch("learningPlanAiTransferAttempts", attempt._id, {
			processingVersion: args.processingVersion,
			sourceDocumentCount: args.sourceDocumentCount,
			sourceBytes: args.sourceBytes,
			reusedDocumentCount: args.reusedDocumentCount,
			sourceFileReadCount: args.sourceFileReadCount,
			rawFilePartCount: args.rawFilePartCount,
			rawFilePartBytes: args.rawFilePartBytes,
			compactContextBytes: args.compactContextBytes,
			selectedChunkCount: args.selectedChunkCount,
			selectedChunkBytes: args.selectedChunkBytes,
		});
		return null;
	},
});

export const finish = internalMutation({
	args: {
		attemptId: v.string(),
		status: v.union(v.literal("succeeded"), v.literal("failed")),
		errorCode: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const attempt = await ctx.db
			.query("learningPlanAiTransferAttempts")
			.withIndex("by_attemptId", (q) => q.eq("attemptId", args.attemptId))
			.unique();
		if (!attempt) return null;
		const modelRequests = await ctx.db
			.query("learningPlanAiModelRequests")
			.withIndex("by_attemptId", (q) => q.eq("attemptId", args.attemptId))
			.take(500);
		const batchIndexes = new Set(
			modelRequests.flatMap((request) =>
				request.batchIndex === undefined ? [] : [request.batchIndex],
			),
		);
		await ctx.db.patch("learningPlanAiTransferAttempts", attempt._id, {
			status: args.status,
			modelRequestCount: modelRequests.length,
			structuredRetryCount: modelRequests.filter(
				(request) => request.retryIndex > 0,
			).length,
			sessionContentBatchCount: batchIndexes.size,
			errorCode: args.errorCode,
			completedAt: Date.now(),
		});
		return null;
	},
});

export const getMyDiagnostics = query({
	args: {
		environment: v.optional(environmentValidator),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];
		const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 50)));
		const attempts = args.environment
			? await ctx.db
					.query("learningPlanAiTransferAttempts")
					.withIndex(
						"by_ownerTokenIdentifier_and_environment_and_createdAt",
						(q) =>
							q
								.eq("ownerTokenIdentifier", identity.tokenIdentifier)
								.eq("environment", args.environment),
					)
					.order("desc")
					.take(limit)
			: await ctx.db
					.query("learningPlanAiTransferAttempts")
					.withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
						q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
					)
					.order("desc")
					.take(limit);
		return attempts.map((attempt) => ({
			attemptId: attempt.attemptId,
			parentAttemptId: attempt.parentAttemptId,
			documentId: attempt.documentId,
			learningPlanId: attempt.learningPlanId,
			operation: attempt.operation,
			environment: attempt.environment ?? "unknown",
			status: attempt.status ?? "succeeded",
			sourceDocumentCount: attempt.sourceDocumentCount,
			sourceBytes: attempt.sourceBytes,
			reusedDocumentCount: attempt.reusedDocumentCount,
			sourceFileReadCount: attempt.sourceFileReadCount,
			rawFilePartCount: attempt.rawFilePartCount,
			rawFilePartBytes: attempt.rawFilePartBytes ?? 0,
			compactContextBytes: attempt.compactContextBytes,
			selectedChunkCount: attempt.selectedChunkCount ?? 0,
			selectedChunkBytes: attempt.selectedChunkBytes ?? 0,
			modelRequestCount: attempt.modelRequestCount ?? 0,
			structuredRetryCount: attempt.structuredRetryCount ?? 0,
			sessionContentBatchCount: attempt.sessionContentBatchCount ?? 0,
			duplicateStartCount: attempt.duplicateStartCount ?? 0,
			providerContextMode: attempt.providerContextMode ?? "persisted_chunks",
			providerReferenceCacheStatus:
				attempt.providerReferenceCacheStatus ?? "not_applicable",
			errorCode: attempt.errorCode,
			startedAt: attempt.startedAt ?? attempt.createdAt,
			completedAt: attempt.completedAt,
		}));
	},
});

export const removeByPlan = internalMutation({
	args: { learningPlanId: v.id("learningPlans") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const attempts = await ctx.db
			.query("learningPlanAiTransferAttempts")
			.withIndex("by_learningPlanId_and_createdAt", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(100);
		const requests = await ctx.db
			.query("learningPlanAiModelRequests")
			.withIndex("by_learningPlanId_and_createdAt", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(100);
		for (const attempt of attempts) {
			await ctx.db.delete("learningPlanAiTransferAttempts", attempt._id);
		}
		for (const request of requests) {
			await ctx.db.delete("learningPlanAiModelRequests", request._id);
		}
		if (attempts.length === 100 || requests.length === 100) {
			await ctx.scheduler.runAfter(
				0,
				internal.learningPlanAiTransfers.removeByPlan,
				{ learningPlanId: args.learningPlanId },
			);
		}
		return null;
	},
});
