/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("deletion blocks the subject, dashboard and preparation APIs added on main", async () => {
	const backend = convexTest(schema, modules);
	const identity = { tokenIdentifier: "deletion-merge:owner" };
	const owner = backend.withIdentity(identity);
	const subject = await owner.mutation(api.personalSubjects.create, {
		name: "Französisch",
	});
	if (subject.kind !== "personal") throw new Error("Expected personal subject");
	const learningPlanId = await backend.run(async (ctx) => {
		const id = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			subject: "Französisch",
			examTypeLabel: "Test",
			examDateKey: "2026-11-01",
			examDateLabel: "1. November",
			durationMinutes: 30,
			topicDescription: "Grammatik",
			status: "draft",
			createdAt: 1,
			updatedAt: 1,
		});
		await ctx.db.insert("accountDeletionRequests", {
			requestId: "deletion-merge-request",
			ownerTokenIdentifier: identity.tokenIdentifier,
			status: "queued",
			stage: "revokeSessions",
			attemptCount: 0,
			deletedRecords: 0,
			policyVersion: "test",
			requestedAt: 1,
			updatedAt: 1,
		});
		return id;
	});

	await expect(owner.query(api.personalSubjects.list, {})).rejects.toThrow(
		"dauerhaft gelöscht",
	);
	await expect(
		owner.mutation(api.personalSubjects.create, { name: "Latein" }),
	).rejects.toThrow("dauerhaft gelöscht");
	await expect(
		owner.mutation(api.personalSubjects.rename, {
			id: subject.id,
			name: "Latein",
		}),
	).rejects.toThrow("dauerhaft gelöscht");
	await expect(
		owner.mutation(api.personalSubjects.remove, { id: subject.id }),
	).rejects.toThrow("dauerhaft gelöscht");
	await expect(
		owner.query(api.dashboardNextStep.isDayIndexReady, {}),
	).rejects.toThrow("dauerhaft gelöscht");
	await expect(
		owner.query(api.dashboardNextStep.listCandidates, {
			todayKey: "2026-10-17",
			paginationOpts: { numItems: 10, cursor: null },
		}),
	).rejects.toThrow("dauerhaft gelöscht");
	await expect(
		owner.query(api.learningPlans.getPreparationSchedule, {
			learningPlanId,
			now: { dateKey: "2026-10-17", minutes: 12 * 60 },
		}),
	).rejects.toThrow("dauerhaft gelöscht");

	expect(
		await backend.run((ctx) => ctx.db.get("personalSubjects", subject.id)),
	).toMatchObject({ name: "Französisch" });
	await expect(
		backend
			.withIdentity({ tokenIdentifier: "deletion-merge:other" })
			.query(api.personalSubjects.list, {}),
	).resolves.toEqual({ personal: [], reusableTimetableSubjects: [] });
});
