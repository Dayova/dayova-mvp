/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const createDocument = async () => {
	const t = convexTest(schema, modules).withIdentity({
		tokenIdentifier: "test:user",
	});
	const documentId = await t.run(async (ctx) => {
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
		return await ctx.db.insert("learningPlanDocuments", {
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
	});
	return { t, documentId };
};

test("only one worker can claim a document processing version", async () => {
	const { t, documentId } = await createDocument();
	const first = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-1",
			processingVersion: 1,
		},
	);
	const concurrent = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-2",
			processingVersion: 1,
		},
	);

	expect(first.status).toBe("claimed");
	expect(concurrent).toEqual({ status: "processing" });

	await t.mutation(internal.learningPlanDocumentProcessing.complete, {
		documentId,
		claimId: "claim-1",
		processingVersion: 1,
		normalizedText: "Steigung ist die Änderung von y pro Änderung von x.",
		extractionMethod: "local",
		sourceChecksum: "checksum",
	});
	const reused = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-3",
			processingVersion: 1,
		},
	);
	expect(reused).toEqual({
		status: "ready",
		normalizedText: "Steigung ist die Änderung von y pro Änderung von x.",
	});
});

test("failed processing is retried only through the explicit retry path", async () => {
	const { t, documentId } = await createDocument();
	await t.mutation(internal.learningPlanDocumentProcessing.claim, {
		documentId,
		claimId: "claim-1",
		processingVersion: 1,
	});
	await t.mutation(internal.learningPlanDocumentProcessing.fail, {
		documentId,
		claimId: "claim-1",
		processingVersion: 1,
		errorMessage: "Nicht lesbar.",
	});

	const ordinaryCall = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-2",
			processingVersion: 1,
		},
	);
	const retry = await t.mutation(
		internal.learningPlanDocumentProcessing.claim,
		{
			documentId,
			claimId: "claim-3",
			processingVersion: 1,
			retryFailed: true,
		},
	);

	expect(ordinaryCall).toEqual({
		status: "failed",
		errorMessage: "Nicht lesbar.",
	});
	expect(retry.status).toBe("claimed");
});
