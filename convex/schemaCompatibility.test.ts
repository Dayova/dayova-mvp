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
