/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const MIB = 1024 * 1024;

test.each([
	{
		name: "normal plan",
		documentCount: 1,
		sourceBytes: 6 * MIB,
		modelRequestCount: 8,
		selectedContextBytes: 64 * 1024,
		usesVision: false,
		operation: "plan" as const,
		minimumReduction: 0.85,
	},
	{
		name: "multimodal plan",
		documentCount: 3,
		sourceBytes: 18 * MIB,
		modelRequestCount: 12,
		selectedContextBytes: 70 * 1024,
		usesVision: true,
		operation: "plan" as const,
		minimumReduction: 0.82,
	},
	{
		name: "structured retry",
		documentCount: 1,
		sourceBytes: 6 * MIB,
		modelRequestCount: 11,
		selectedContextBytes: 64 * 1024,
		usesVision: false,
		operation: "session_retry" as const,
		minimumReduction: 0.89,
	},
])("measures instrumented material transport for $name", async ({
	documentCount,
	sourceBytes,
	modelRequestCount,
	selectedContextBytes,
	usesVision,
	operation,
	minimumReduction,
}) => {
	const t = convexTest(schema, modules).withIdentity({
		tokenIdentifier: "test:user",
	});
	const { learningPlanId, documentIds } = await t.run(async (ctx) => {
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
		const bytesPerDocument = sourceBytes / documentCount;
		const documentIds = [];
		for (let index = 0; index < documentCount; index += 1) {
			documentIds.push(
				await ctx.db.insert("learningPlanDocuments", {
					ownerTokenIdentifier: "test:user",
					learningPlanId,
					storageId: `fixture-${index}`,
					storageProvider: "r2",
					fileName: usesVision
						? `material-${index}.pdf`
						: `material-${index}.txt`,
					fileType: usesVision ? "application/pdf" : "text/plain",
					fileSizeBytes: bytesPerDocument,
					sourceKind: "school",
					createdAt: now,
				}),
			);
		}
		return { learningPlanId, documentIds };
	});

	const bytesPerDocument = sourceBytes / documentCount;
	for (const [index, documentId] of documentIds.entries()) {
		const attemptId = `ingestion-${index}`;
		await t.mutation(internal.learningPlanAiTransfers.startDocumentIngestion, {
			documentId,
			attemptId,
			processingVersion: 2,
			environment: "development",
		});
		await t.mutation(internal.learningPlanAiTransfers.recordTransfer, {
			learningPlanId,
			attemptId,
			processingVersion: 2,
			sourceDocumentCount: 1,
			sourceBytes: bytesPerDocument,
			reusedDocumentCount: 0,
			sourceFileReadCount: 1,
			rawFilePartCount: usesVision ? 1 : 0,
			rawFilePartBytes: usesVision ? bytesPerDocument : 0,
			compactContextBytes: 0,
			selectedChunkCount: 0,
			selectedChunkBytes: 0,
		});
		if (usesVision) {
			await t.mutation(internal.learningPlanAiUsage.recordModelRequest, {
				learningPlanId,
				operation: "document_extraction",
				modelId: "fixture-vision-model",
				attemptId,
				retryIndex: 0,
			});
		}
		await t.mutation(internal.learningPlanAiTransfers.finish, {
			attemptId,
			status: "succeeded",
		});
	}

	const generationAttemptId = "generation";
	await t.mutation(internal.learningPlanAiTransfers.start, {
		learningPlanId,
		attemptId: generationAttemptId,
		dedupeKey: `${operation}:${learningPlanId}`,
		operation,
		environment: "development",
	});
	await t.mutation(internal.learningPlanAiTransfers.recordTransfer, {
		learningPlanId,
		attemptId: generationAttemptId,
		processingVersion: 2,
		sourceDocumentCount: documentCount,
		sourceBytes,
		reusedDocumentCount: documentCount,
		sourceFileReadCount: 0,
		rawFilePartCount: 0,
		rawFilePartBytes: 0,
		compactContextBytes: selectedContextBytes,
		selectedChunkCount: documentCount,
		selectedChunkBytes: selectedContextBytes,
	});
	for (
		let requestIndex = 0;
		requestIndex < modelRequestCount;
		requestIndex += 1
	) {
		await t.mutation(internal.learningPlanAiUsage.recordModelRequest, {
			learningPlanId,
			operation: operation === "plan" ? "plan" : "session_practice",
			modelId: "fixture-generation-model",
			attemptId: generationAttemptId,
			retryIndex: operation === "session_retry" && requestIndex > 7 ? 1 : 0,
			batchIndex: Math.floor(requestIndex / 3),
		});
	}
	await t.mutation(internal.learningPlanAiTransfers.finish, {
		attemptId: generationAttemptId,
		status: "succeeded",
	});

	const diagnostics = await t.query(
		api.learningPlanAiTransfers.getMyDiagnostics,
		{ environment: "development", limit: 20 },
	);
	const ingestionAttempts = diagnostics.filter(
		(attempt) => attempt.operation === "document_ingestion",
	);
	const generationAttempt = diagnostics.find(
		(attempt) => attempt.attemptId === generationAttemptId,
	);
	expect(generationAttempt).toBeDefined();
	expect(generationAttempt).toMatchObject({
		reusedDocumentCount: documentCount,
		sourceFileReadCount: 0,
		rawFilePartCount: 0,
		modelRequestCount,
	});
	expect(ingestionAttempts).toHaveLength(documentCount);

	const beforeBytes =
		(generationAttempt?.sourceBytes ?? 0) *
		(generationAttempt?.modelRequestCount ?? 0);
	const afterBytes =
		ingestionAttempts.reduce(
			(total, attempt) =>
				total +
				attempt.sourceBytes * attempt.sourceFileReadCount +
				attempt.rawFilePartBytes,
			0,
		) +
		(generationAttempt?.compactContextBytes ?? 0) *
			(generationAttempt?.modelRequestCount ?? 0);
	const reductionRatio = 1 - afterBytes / beforeBytes;

	expect(afterBytes).toBeLessThan(beforeBytes);
	expect(reductionRatio).toBeGreaterThanOrEqual(minimumReduction);
});
