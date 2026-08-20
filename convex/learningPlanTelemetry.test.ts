/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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

	await t.mutation(internal.learningPlanAiTransfers.record, {
		learningPlanId,
		attemptId: "attempt-1",
		operation: "plan",
		processingVersion: 1,
		sourceDocumentCount: 2,
		sourceBytes: 4_096,
		reusedDocumentCount: 2,
		sourceFileReadCount: 0,
		rawFilePartCount: 0,
		compactContextBytes: 1_024,
	});
	await t.mutation(internal.learningPlanUploadTelemetry.recordRejection, {
		ownerTokenIdentifier: "test:user",
		learningPlanId,
		fileSizeBytes: 8 * 1024 * 1024,
		fileType: "application/pdf",
		reason: "registration_rejected",
	});

	const metrics = await t.run(async (ctx) => ({
		transfers: await ctx.db.query("learningPlanAiTransferAttempts").take(10),
		rejections: await ctx.db.query("learningPlanUploadRejections").take(10),
	}));
	expect(metrics.transfers).toEqual([
		expect.objectContaining({
			learningPlanId,
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
			reason: "registration_rejected",
		}),
	]);
});
