/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	tokenIdentifier: "test:schema-compatibility",
};

test("AI budget accounting data from prior deployments remains schema-compatible", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-09-05",
		title: "Mathe Klausur",
		kind: "Leistungskontrolle",
		plannedDateLabel: "5. September 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});
	const learningPlanId = await t.mutation(api.learningPlans.start, {
		examDayEntryId,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-09-05",
		examDateLabel: "5. September 2026",
		durationMinutes: 90,
		topicDescription: "Lineare Funktionen",
	});

	await expect(
		t.run(async (ctx) => {
			const usageId = await ctx.db.insert("learningPlanAiUsage", {
				ownerTokenIdentifier: user.tokenIdentifier,
				learningPlanId,
				reservationId: "reservation-1",
				operation: "session_theory",
				modelId: "gemini-3-flash-preview",
				inputTokens: 5_058,
				cachedInputTokens: 0,
				outputTokens: 1_057,
				estimatedCostUsdMicros: 5_700,
				budgetCostUsdMicros: 5_700,
				accountingKind: "measured",
				createdAt: Date.now(),
			});
			const reservationDocumentId = await ctx.db.insert(
				"learningPlanAiBudgetReservations",
				{
					ownerTokenIdentifier: user.tokenIdentifier,
					learningPlanId,
					reservationId: "reservation-1",
					operation: "session_theory",
					modelId: "gemini-3-flash-preview",
					projectedCostUsdMicros: 5_700,
					status: "settled",
					monthStart: Date.UTC(2026, 8, 1),
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
			);
			return { usageId, reservationDocumentId };
		}),
	).resolves.toMatchObject({
		usageId: expect.any(String),
		reservationDocumentId: expect.any(String),
	});
});

test("preserves metadata written by earlier development backends", async () => {
	const t = convexTest(schema, import.meta.glob("./**/*.ts"));
	await t.run(async (ctx) => {
		const dismissal = { learningRoutineDismissedDateKey: "2026-09-24" };
		const userId = await ctx.db.insert("users", {
			tokenIdentifier: "compat:owner",
			clerkId: "fixture-user",
			email: "fixture@example.com",
			...dismissal,
		});
		expect(await ctx.db.get("users", userId)).toMatchObject(dismissal);
		const legacyPlanMetadata = {
			initialLearningTimePromptDismissedAt: 1,
			masteryStatus: "learning" as const,
		};
		const planId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "compat:owner",
			subject: "Mathematik",
			examTypeLabel: "Test",
			examDateKey: "2027-06-01",
			examDateLabel: "1. Juni",
			durationMinutes: 30,
			topicDescription: "Gleichungen",
			status: "accepted",
			createdAt: 1,
			updatedAt: 1,
			...legacyPlanMetadata,
		});
		expect(await ctx.db.get("learningPlans", planId)).toMatchObject(
			legacyPlanMetadata,
		);
		const metadata = {
			processingStatus: "ready" as const,
			processingVersion: 2,
		};
		const id = await ctx.db.insert("learningPlanDocuments", {
			ownerTokenIdentifier: "compat:owner",
			learningPlanId: planId,
			storageId: "fixture",
			storageProvider: "convex",
			fileName: "fixture.pdf",
			fileType: "application/pdf",
			fileSizeBytes: 100,
			sourceKind: "school",
			createdAt: 1,
			...metadata,
		});
		expect(await ctx.db.get("learningPlanDocuments", id)).toMatchObject(
			metadata,
		);
		const preference = {
			preferenceStatus: "proposed" as const,
			proposedForLearningPlanId: planId,
		};
		const timeId = await ctx.db.insert("userLearningTimes", {
			ownerTokenIdentifier: "compat:owner",
			dayOfWeek: 1,
			startTime: "16:00",
			endTime: "17:00",
			createdAt: 1,
			updatedAt: 1,
			...preference,
		});
		expect(await ctx.db.get("userLearningTimes", timeId)).toMatchObject(
			preference,
		);
	});
});
