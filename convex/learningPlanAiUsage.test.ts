/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const owner = "qa:usage-owner";
const setup = async () => {
	const t = convexTest(schema, modules);
	const learningPlanId = await t.run((ctx) =>
		ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: owner,
			subject: "Italienisch",
			examTypeLabel: "Test",
			examDateKey: "2026-09-30",
			examDateLabel: "30. September 2026",
			durationMinutes: 30,
			topicDescription: "A1",
			status: "draft",
			createdAt: 1,
			updatedAt: 1,
		}),
	);
	return {
		t,
		args: {
			learningPlanId,
			operation: "document_extraction" as const,
			modelId: "qa-model",
			inputTokens: 100,
			cachedInputTokens: 0,
			outputTokens: 20,
			estimatedCostUsdMicros: 10,
		},
	};
};

test("background document extraction records usage without a client identity", async () => {
	const { t, args } = await setup();
	const id = await t.mutation(internal.learningPlanAiUsage.record, args);
	const record = await t.run((ctx) => ctx.db.get("learningPlanAiUsage", id));
	expect(record).toMatchObject({ ownerTokenIdentifier: owner, ...args });
});

test("authenticated owner can still record usage", async () => {
	const { t, args } = await setup();
	await expect(
		t
			.withIdentity({ tokenIdentifier: owner })
			.mutation(internal.learningPlanAiUsage.record, args),
	).resolves.toBeTruthy();
});

test("an authenticated foreign owner cannot record another plan's usage", async () => {
	const { t, args } = await setup();
	await expect(
		t
			.withIdentity({ tokenIdentifier: "qa:other" })
			.mutation(internal.learningPlanAiUsage.record, args),
	).rejects.toThrow("Lernplan nicht gefunden");
});

test("background usage cannot recreate data for an account being deleted", async () => {
	const { t, args } = await setup();
	await t.run((ctx) =>
		ctx.db.insert("accountDeletionRequests", {
			requestId: "qa-deletion",
			ownerTokenIdentifier: owner,
			status: "queued",
			stage: "revokeSessions",
			attemptCount: 0,
			deletedRecords: 0,
			policyVersion: "qa",
			requestedAt: 1,
			updatedAt: 1,
		}),
	);
	await expect(
		t.mutation(internal.learningPlanAiUsage.record, args),
	).rejects.toThrow("dauerhaft gelöscht");
});

test("missing plans cannot acquire orphan usage records", async () => {
	const { t, args } = await setup();
	await t.run((ctx) => ctx.db.delete("learningPlans", args.learningPlanId));
	await expect(
		t.mutation(internal.learningPlanAiUsage.record, args),
	).rejects.toThrow("Lernplan nicht gefunden");
});
