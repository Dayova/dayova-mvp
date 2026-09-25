/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { DOCUMENT_PROCESSING_VERSION } from "./learningPlanDocumentProcessing";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => vi.useRealTimers());

const createDocument = async () => {
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
			storageId: "storage-1",
			storageProvider: "r2",
			fileName: "arbeitsblatt.pdf",
			fileType: "application/pdf",
			fileSizeBytes: 1_024,
			sourceKind: "school",
			createdAt: now,
		});
		return { documentId, learningPlanId };
	});
	return { t, documentId, learningPlanId };
};

test("only one worker can claim a document processing version", async () => {
	const { t, documentId, learningPlanId } = await createDocument();
	const first = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-1",
			processingVersion: DOCUMENT_PROCESSING_VERSION,
		},
	);
	const concurrent = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-2",
			processingVersion: DOCUMENT_PROCESSING_VERSION,
		},
	);

	expect(first.status).toBe("claimed");
	expect(concurrent).toEqual({ status: "processing" });

	await t.mutation(internal.learningPlanDocumentProcessing.complete, {
		documentId,
		claimId: "claim-1",
		processingVersion: DOCUMENT_PROCESSING_VERSION,
		chunks: [
			{
				chunkIndex: 0,
				charStart: 0,
				charEnd: 55,
				text: "Steigung ist die Änderung von y pro Änderung von x.",
			},
		],
		totalTextChars: 55,
		extractionMethod: "local",
		sourceChecksum: "checksum",
	});
	const reused = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-3",
			processingVersion: DOCUMENT_PROCESSING_VERSION,
		},
	);
	expect(reused).toEqual({ status: "ready" });
	const relevant = await t.query(
		internal.learningPlanDocumentProcessing.getRelevantChunks,
		{
			learningPlanId,
			documentIds: [documentId],
			selectionQuery: "Steigung Änderung",
		},
	);
	expect(relevant).toEqual([
		expect.objectContaining({
			documentId,
			chunkIndex: 0,
			text: "Steigung ist die Änderung von y pro Änderung von x.",
		}),
	]);
	const recurringClaims = await Promise.all(
		["diagnostic", "plan", "session", "retry"].map((operation) =>
			t.mutation(internal.learningPlanDocumentProcessing.claim, {
				documentId,
				claimId: `claim-${operation}`,
				processingVersion: DOCUMENT_PROCESSING_VERSION,
			}),
		),
	);
	expect(recurringClaims).toEqual(
		Array.from({ length: 4 }, () => ({ status: "ready" })),
	);
	expect(
		await t.run(async (ctx) => ({
			contexts: await ctx.db
				.query("learningPlanDocumentContexts")
				.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
				.take(10),
			chunks: await ctx.db
				.query("learningPlanDocumentChunks")
				.withIndex("by_documentId_and_chunkIndex", (q) =>
					q.eq("documentId", documentId),
				)
				.take(10),
		})),
	).toMatchObject({
		contexts: [{ status: "ready" }],
		chunks: [{ chunkIndex: 0 }],
	});
});

test("failed processing is retried only through the explicit retry path", async () => {
	const { t, documentId } = await createDocument();
	await t.mutation(internal.learningPlanDocumentProcessing.claim, {
		documentId,
		claimId: "claim-1",
		processingVersion: DOCUMENT_PROCESSING_VERSION,
	});
	await t.mutation(internal.learningPlanDocumentProcessing.fail, {
		documentId,
		claimId: "claim-1",
		processingVersion: DOCUMENT_PROCESSING_VERSION,
		errorMessage: "Nicht lesbar.",
	});

	const ordinaryCall = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-2",
			processingVersion: DOCUMENT_PROCESSING_VERSION,
		},
	);
	const retry = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-3",
			processingVersion: DOCUMENT_PROCESSING_VERSION,
			retryFailed: true,
		},
	);

	expect(ordinaryCall).toEqual({
		status: "failed",
		errorMessage: "Nicht lesbar.",
	});
	expect(retry.status).toBe("claimed");
});

test("deletes large persisted contexts through bounded scheduled batches", async () => {
	vi.useFakeTimers();
	const { t, documentId, learningPlanId } = await createDocument();
	await t.run(async (ctx) => {
		const now = Date.now();
		const contextId = await ctx.db.insert("learningPlanDocumentContexts", {
			ownerTokenIdentifier: "test:user",
			learningPlanId,
			documentId,
			processingVersion: DOCUMENT_PROCESSING_VERSION,
			status: "ready",
			sourceFileSizeBytes: 1_024,
			chunkCount: 85,
			totalTextChars: 85,
			createdAt: now,
			updatedAt: now,
		});
		for (let index = 0; index < 85; index += 1) {
			await ctx.db.insert("learningPlanDocumentChunks", {
				ownerTokenIdentifier: "test:user",
				learningPlanId,
				documentId,
				contextId,
				processingVersion: DOCUMENT_PROCESSING_VERSION,
				chunkIndex: index,
				charStart: index,
				charEnd: index + 1,
				text: `${index}`,
				createdAt: now,
			});
		}
	});

	await t.mutation(internal.learningPlanDocumentProcessing.removeByPlan, {
		learningPlanId,
	});
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(
		await t.run(async (ctx) => ({
			chunks: await ctx.db
				.query("learningPlanDocumentChunks")
				.withIndex("by_learningPlanId", (q) =>
					q.eq("learningPlanId", learningPlanId),
				)
				.take(1),
			contexts: await ctx.db
				.query("learningPlanDocumentContexts")
				.withIndex("by_learningPlanId", (q) =>
					q.eq("learningPlanId", learningPlanId),
				)
				.take(1),
		})),
	).toEqual({ chunks: [], contexts: [] });
});

test("clears replacement chunks in bounded claim-owned batches", async () => {
	const { t, documentId, learningPlanId } = await createDocument();
	await t.mutation(internal.learningPlanDocumentProcessing.claim, {
		documentId,
		claimId: "claim-replacement",
		processingVersion: DOCUMENT_PROCESSING_VERSION,
	});
	await t.run(async (ctx) => {
		const context = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
			.unique();
		if (!context) throw new Error("Missing context");
		for (let index = 0; index < 85; index += 1) {
			await ctx.db.insert("learningPlanDocumentChunks", {
				ownerTokenIdentifier: "test:user",
				learningPlanId,
				documentId,
				contextId: context._id,
				processingVersion: DOCUMENT_PROCESSING_VERSION - 1,
				chunkIndex: index,
				charStart: index,
				charEnd: index + 1,
				text: `${index}`,
				createdAt: Date.now(),
			});
		}
	});

	expect(
		await t.mutation(
			internal.learningPlanDocumentProcessing.clearChunksForClaim,
			{
				documentId,
				claimId: "wrong-claim",
				processingVersion: DOCUMENT_PROCESSING_VERSION,
			},
		),
	).toEqual({ accepted: false, complete: true });
	let result = { accepted: true, complete: false };
	let calls = 0;
	while (!result.complete) {
		result = await t.mutation(
			internal.learningPlanDocumentProcessing.clearChunksForClaim,
			{
				documentId,
				claimId: "claim-replacement",
				processingVersion: DOCUMENT_PROCESSING_VERSION,
			},
		);
		calls += 1;
	}
	expect(calls).toBe(3);
	expect(
		await t.run((ctx) =>
			ctx.db
				.query("learningPlanDocumentChunks")
				.withIndex("by_documentId_and_chunkIndex", (q) =>
					q.eq("documentId", documentId),
				)
				.take(1),
		),
	).toEqual([]);
});

test("deletes a single document context through bounded scheduled batches", async () => {
	vi.useFakeTimers();
	const { t, documentId, learningPlanId } = await createDocument();
	await t.run(async (ctx) => {
		const now = Date.now();
		const contextId = await ctx.db.insert("learningPlanDocumentContexts", {
			ownerTokenIdentifier: "test:user",
			learningPlanId,
			documentId,
			processingVersion: DOCUMENT_PROCESSING_VERSION,
			status: "ready",
			sourceFileSizeBytes: 1_024,
			chunkCount: 85,
			totalTextChars: 85,
			createdAt: now,
			updatedAt: now,
		});
		for (let index = 0; index < 85; index += 1) {
			await ctx.db.insert("learningPlanDocumentChunks", {
				ownerTokenIdentifier: "test:user",
				learningPlanId,
				documentId,
				contextId,
				processingVersion: DOCUMENT_PROCESSING_VERSION,
				chunkIndex: index,
				charStart: index,
				charEnd: index + 1,
				text: `${index}`,
				createdAt: now,
			});
		}
	});

	await t.mutation(internal.learningPlanDocumentProcessing.removeByDocument, {
		documentId,
	});
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(
		await t.run(async (ctx) => ({
			chunks: await ctx.db
				.query("learningPlanDocumentChunks")
				.withIndex("by_documentId_and_chunkIndex", (q) =>
					q.eq("documentId", documentId),
				)
				.take(1),
			contexts: await ctx.db
				.query("learningPlanDocumentContexts")
				.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
				.take(1),
		})),
	).toEqual({ chunks: [], contexts: [] });
});

test("large multibyte documents persist in bounded claimed batches and remain hidden until complete", async () => {
	const { t, documentId, learningPlanId } = await createDocument();
	const claim = {
		documentId,
		claimId: "batch-claim",
		processingVersion: DOCUMENT_PROCESSING_VERSION,
	};
	await t.mutation(internal.learningPlanDocumentProcessing.claim, claim);
	const chunks = Array.from({ length: 320 }, (_, chunkIndex) => ({
		chunkIndex,
		charStart: chunkIndex * 24000,
		charEnd: (chunkIndex + 1) * 24000,
		text: "界".repeat(24000),
	}));
	await expect(
		t.mutation(internal.learningPlanDocumentProcessing.appendChunks, {
			...claim,
			chunks: chunks.slice(0, 41),
		}),
	).rejects.toThrow("batch exceeds");
	for (let offset = 0; offset < 280; offset += 40) {
		expect(
			await t.mutation(internal.learningPlanDocumentProcessing.appendChunks, {
				...claim,
				chunks: chunks.slice(offset, offset + 40),
			}),
		).toBe(true);
	}
	expect(
		await t.query(internal.learningPlanDocumentProcessing.getRelevantChunks, {
			learningPlanId,
			documentIds: [documentId],
			selectionQuery: "界",
		}),
	).toEqual([]);
	expect(
		await t.mutation(internal.learningPlanDocumentProcessing.appendChunks, {
			...claim,
			claimId: "stale",
			chunks: chunks.slice(280),
		}),
	).toBe(false);
	await expect(
		t.mutation(internal.learningPlanDocumentProcessing.appendChunks, {
			...claim,
			chunks: chunks.slice(0, 1),
		}),
	).rejects.toThrow("sequence");
	expect(
		await t.mutation(internal.learningPlanDocumentProcessing.complete, {
			...claim,
			chunks: chunks.slice(280),
			totalTextChars: 320 * 24000,
			extractionMethod: "local",
			sourceChecksum: "large",
		}),
	).toBe(true);
	const context = await t.run((ctx) =>
		ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
			.unique(),
	);
	expect(context).toMatchObject({ status: "ready", chunkCount: 320 });
});

test("excluded documents cannot crowd relevant school chunks out of search", async () => {
	const { t, documentId, learningPlanId } = await createDocument();
	const claim = {
		documentId,
		claimId: "school",
		processingVersion: DOCUMENT_PROCESSING_VERSION,
	};
	await t.mutation(internal.learningPlanDocumentProcessing.claim, claim);
	await t.mutation(internal.learningPlanDocumentProcessing.complete, {
		...claim,
		chunks: [
			{ chunkIndex: 0, charStart: 0, charEnd: 10, text: "Einleitung" },
			{
				chunkIndex: 1,
				charStart: 10,
				charEnd: 30,
				text: "Steigung Mathematik",
			},
		],
		totalTextChars: 30,
		extractionMethod: "local",
		sourceChecksum: "school",
	});
	await t.run(async (ctx) => {
		const doc = await ctx.db.get("learningPlanDocuments", documentId);
		if (!doc) throw new Error("Missing fixture");
		const { _id, _creationTime, ...fields } = doc;
		const excluded = await ctx.db.insert("learningPlanDocuments", {
			...fields,
			sourceKind: "external",
		});
		const context = await ctx.db
			.query("learningPlanDocumentContexts")
			.withIndex("by_documentId", (q) => q.eq("documentId", documentId))
			.unique();
		if (!context) throw new Error("Missing context");
		for (let i = 0; i < 20; i++)
			await ctx.db.insert("learningPlanDocumentChunks", {
				ownerTokenIdentifier: "test:user",
				learningPlanId,
				documentId: excluded,
				contextId: context._id,
				processingVersion: DOCUMENT_PROCESSING_VERSION,
				chunkIndex: i,
				charStart: 0,
				charEnd: 8,
				text: "Steigung",
				createdAt: 0,
			});
	});
	const selected = await t.query(
		internal.learningPlanDocumentProcessing.getRelevantChunks,
		{ learningPlanId, documentIds: [documentId], selectionQuery: "Steigung" },
	);
	expect(selected).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				documentId,
				chunkIndex: 1,
				text: "Steigung Mathematik",
			}),
		]),
	);
	expect(selected.every((chunk) => chunk.documentId === documentId)).toBe(true);
});
