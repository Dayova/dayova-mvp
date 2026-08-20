/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => vi.useRealTimers());

test("stores privacy-safe transfer and upload-rejection metrics", async () => {
	const t = convexTest(schema, modules).withIdentity({
		tokenIdentifier: "test:user",
	});
	const learningPlanId = await t.run(async (ctx) => {
		const now = Date.now();
		return await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "test:user",
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
	});

	expect(
		await t.mutation(internal.learningPlanAiTransfers.start, {
			learningPlanId,
			attemptId: "attempt-1",
			dedupeKey: "plan:revision-1",
			operation: "plan",
			environment: "development",
		}),
	).toEqual({ started: true });
	expect(
		await t.mutation(internal.learningPlanAiTransfers.start, {
			learningPlanId,
			attemptId: "attempt-duplicate",
			dedupeKey: "plan:revision-1",
			operation: "plan",
			environment: "development",
		}),
	).toEqual({ started: false, activeAttemptId: "attempt-1" });
	await t.mutation(internal.learningPlanAiTransfers.recordTransfer, {
		learningPlanId,
		attemptId: "attempt-1",
		processingVersion: 2,
		sourceDocumentCount: 2,
		sourceBytes: 4_096,
		reusedDocumentCount: 2,
		sourceFileReadCount: 0,
		rawFilePartCount: 0,
		rawFilePartBytes: 0,
		compactContextBytes: 1_024,
		selectedChunkCount: 3,
		selectedChunkBytes: 960,
	});
	for (const [retryIndex, batchIndex] of [
		[0, 0],
		[1, 0],
		[0, 1],
	] as const) {
		await t.mutation(internal.learningPlanAiUsage.recordModelRequest, {
			learningPlanId,
			operation: "session_theory",
			modelId: "test-model",
			attemptId: "attempt-1",
			retryIndex,
			batchIndex,
		});
	}
	await t.mutation(internal.learningPlanAiTransfers.finish, {
		attemptId: "attempt-1",
		status: "succeeded",
	});
	await t.mutation(internal.learningPlanUploadTelemetry.recordRejection, {
		ownerTokenIdentifier: "test:user",
		learningPlanId,
		fileSizeBytes: 8 * 1024 * 1024,
		fileType: "application/pdf",
		reason: "file_too_large",
		existingFileCount: 4,
		existingTotalBytes: 20 * 1024 * 1024,
	});

	const diagnostics = await t.query(
		api.learningPlanAiTransfers.getMyDiagnostics,
		{ environment: "development" },
	);
	const metrics = await t.run(async (ctx) => ({
		transfers: await ctx.db.query("learningPlanAiTransferAttempts").take(10),
		rejections: await ctx.db.query("learningPlanUploadRejections").take(10),
	}));
	expect(diagnostics).toEqual([
		expect.objectContaining({
			attemptId: "attempt-1",
			status: "succeeded",
			environment: "development",
			modelRequestCount: 3,
			structuredRetryCount: 1,
			sessionContentBatchCount: 2,
			duplicateStartCount: 1,
		}),
	]);
	expect(metrics.transfers).toEqual([
		expect.objectContaining({
			learningPlanId,
			status: "succeeded",
			reusedDocumentCount: 2,
			sourceFileReadCount: 0,
			rawFilePartCount: 0,
			compactContextBytes: 1_024,
		}),
	]);
	expect(metrics.rejections).toEqual([
		expect.objectContaining({
			learningPlanId,
			fileSizeBytes: 8 * 1024 * 1024,
			fileType: "application/pdf",
			reason: "file_too_large",
			fileSizeBucket: "gt_7_mib",
			existingFileCount: 4,
		}),
	]);
	expect(JSON.stringify(metrics.rejections)).not.toContain("fileName");
});

test("rejects transfer attempts for a plan owned by another identity", async () => {
	const backend = convexTest(schema, modules);
	const owner = backend.withIdentity({ tokenIdentifier: "test:owner" });
	const attacker = backend.withIdentity({ tokenIdentifier: "test:attacker" });
	const learningPlanId = await owner.run(async (ctx) => {
		const now = Date.now();
		return await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "test:owner",
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
	});

	await expect(
		attacker.mutation(internal.learningPlanAiTransfers.start, {
			learningPlanId,
			attemptId: "poison-attempt",
			dedupeKey: `diagnostic:${learningPlanId}`,
			operation: "diagnostic",
			environment: "development",
		}),
	).rejects.toThrow("Lernplan nicht gefunden");
	expect(
		await owner.mutation(internal.learningPlanAiTransfers.start, {
			learningPlanId,
			attemptId: "owner-attempt",
			dedupeKey: `diagnostic:${learningPlanId}`,
			operation: "diagnostic",
			environment: "development",
		}),
	).toEqual({ started: true });
});

test("counts the one-time multimodal file part and extraction request", async () => {
	const t = convexTest(schema, modules).withIdentity({
		tokenIdentifier: "test:user",
	});
	const { documentId, learningPlanId } = await t.run(async (ctx) => {
		const now = Date.now();
		const learningPlanId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "test:user",
			subject: "Biologie",
			examTypeLabel: "Klausur",
			examDateKey: "2026-09-10",
			examDateLabel: "10. September 2026",
			durationMinutes: 90,
			topicDescription: "Zellbiologie",
			status: "draft",
			createdAt: now,
			updatedAt: now,
		});
		const documentId = await ctx.db.insert("learningPlanDocuments", {
			ownerTokenIdentifier: "test:user",
			learningPlanId,
			storageId: "image-heavy-pdf",
			storageProvider: "r2",
			fileName: "zellbiologie.pdf",
			fileType: "application/pdf",
			fileSizeBytes: 6 * 1024 * 1024,
			sourceKind: "school",
			createdAt: now,
		});
		return { documentId, learningPlanId };
	});

	expect(
		await t.mutation(internal.learningPlanAiTransfers.startDocumentIngestion, {
			documentId,
			attemptId: "ingestion-attempt",
			processingVersion: 2,
			environment: "development",
		}),
	).toEqual({ started: true });
	await t.mutation(internal.learningPlanAiTransfers.recordTransfer, {
		learningPlanId,
		attemptId: "ingestion-attempt",
		processingVersion: 2,
		sourceDocumentCount: 1,
		sourceBytes: 6 * 1024 * 1024,
		reusedDocumentCount: 0,
		sourceFileReadCount: 1,
		rawFilePartCount: 1,
		rawFilePartBytes: 6 * 1024 * 1024,
		compactContextBytes: 0,
		selectedChunkCount: 0,
		selectedChunkBytes: 0,
	});
	await t.mutation(internal.learningPlanAiUsage.recordModelRequest, {
		learningPlanId,
		operation: "document_extraction",
		modelId: "test-vision-model",
		attemptId: "ingestion-attempt",
		retryIndex: 0,
	});
	await t.mutation(internal.learningPlanAiTransfers.finish, {
		attemptId: "ingestion-attempt",
		status: "succeeded",
	});

	expect(
		await t.query(api.learningPlanAiTransfers.getMyDiagnostics, {
			environment: "development",
		}),
	).toEqual([
		expect.objectContaining({
			operation: "document_ingestion",
			providerContextMode: "one_time_ingestion",
			sourceFileReadCount: 1,
			rawFilePartCount: 1,
			rawFilePartBytes: 6 * 1024 * 1024,
			modelRequestCount: 1,
		}),
	]);
});

test("links lazy document ingestion to its durable parent generation attempt", async () => {
	const t = convexTest(schema, modules).withIdentity({
		tokenIdentifier: "test:user",
	});
	const { documentId, learningPlanId } = await t.run(async (ctx) => {
		const now = Date.now();
		const learningPlanId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "test:user",
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
			ownerTokenIdentifier: "test:user",
			learningPlanId,
			storageId: "lazy-document",
			storageProvider: "r2",
			fileName: "analysis.txt",
			fileType: "text/plain",
			fileSizeBytes: 1_024,
			sourceKind: "school",
			createdAt: now,
		});
		return { documentId, learningPlanId };
	});

	await t.mutation(internal.learningPlanAiTransfers.start, {
		learningPlanId,
		attemptId: "generation-parent",
		dedupeKey: "diagnostic:revision-1",
		operation: "diagnostic",
		environment: "development",
	});
	await t.mutation(internal.learningPlanAiTransfers.startDocumentIngestion, {
		documentId,
		attemptId: "ingestion-child",
		parentAttemptId: "generation-parent",
		processingVersion: 2,
		environment: "development",
	});

	const diagnostics = await t.query(
		api.learningPlanAiTransfers.getMyDiagnostics,
		{ environment: "development" },
	);
	expect(
		diagnostics.find((attempt) => attempt.attemptId === "ingestion-child"),
	).toMatchObject({
		parentAttemptId: "generation-parent",
		documentId,
		learningPlanId,
		operation: "document_ingestion",
	});
	await expect(
		t.mutation(internal.learningPlanAiTransfers.startDocumentIngestion, {
			documentId,
			attemptId: "invalid-child",
			parentAttemptId: "missing-parent",
			processingVersion: 2,
			environment: "development",
		}),
	).rejects.toThrow("Invalid parent generation attempt");
});

test("continues privacy telemetry cleanup beyond a single mutation batch", async () => {
	vi.useFakeTimers();
	const t = convexTest(schema, modules).withIdentity({
		tokenIdentifier: "test:user",
	});
	const learningPlanId = await t.run(async (ctx) => {
		const now = Date.now();
		const planId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "test:user",
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
		for (let index = 0; index < 205; index += 1) {
			await ctx.db.insert("learningPlanAiTransferAttempts", {
				ownerTokenIdentifier: "test:user",
				learningPlanId: planId,
				attemptId: `attempt-${index}`,
				operation: "plan",
				processingVersion: 2,
				sourceDocumentCount: 1,
				sourceBytes: 1_024,
				reusedDocumentCount: 1,
				sourceFileReadCount: 0,
				rawFilePartCount: 0,
				compactContextBytes: 256,
				createdAt: now + index,
			});
			await ctx.db.insert("learningPlanAiModelRequests", {
				ownerTokenIdentifier: "test:user",
				learningPlanId: planId,
				attemptId: `attempt-${index}`,
				operation: "plan",
				modelId: "test-model",
				retryIndex: 0,
				createdAt: now + index,
			});
			await ctx.db.insert("learningPlanUploadRejections", {
				ownerTokenIdentifier: "test:user",
				learningPlanId: planId,
				fileSizeBytes: 8 * 1024 * 1024,
				fileType: "application/pdf",
				reason: "registration_rejected",
				createdAt: now + index,
			});
			await ctx.db.insert("learningPlanAiUsage", {
				ownerTokenIdentifier: "test:user",
				learningPlanId: planId,
				operation: "plan",
				modelId: "test-model",
				inputTokens: 1,
				cachedInputTokens: 0,
				outputTokens: 1,
				estimatedCostUsdMicros: 1,
				createdAt: now + index,
			});
		}
		return planId;
	});

	await t.mutation(internal.learningPlanAiTransfers.removeByPlan, {
		learningPlanId,
	});
	await t.mutation(internal.learningPlanUploadTelemetry.removeByPlan, {
		learningPlanId,
	});
	await t.mutation(internal.learningPlanAiUsage.removeByPlan, {
		learningPlanId,
	});
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());

	expect(
		await t.run(async (ctx) => ({
			attempts: await ctx.db.query("learningPlanAiTransferAttempts").take(1),
			requests: await ctx.db.query("learningPlanAiModelRequests").take(1),
			rejections: await ctx.db.query("learningPlanUploadRejections").take(1),
			usage: await ctx.db.query("learningPlanAiUsage").take(1),
		})),
	).toEqual({ attempts: [], requests: [], rejections: [], usage: [] });
});
