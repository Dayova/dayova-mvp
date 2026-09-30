/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const userIdentity = {
	subject: "user",
	tokenIdentifier: "test:user",
	email: "user@example.com",
};

const otherIdentity = {
	subject: "other",
	tokenIdentifier: "test:other",
	email: "other@example.com",
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

test("HTTP password verification propagates identity without fva", async () => {
	vi.stubEnv("CLERK_SECRET_KEY", "test-server-key");
	const verify = vi.fn().mockResolvedValue(Response.json({ verified: true }));
	vi.stubGlobal("fetch", verify);
	const backend = convexTest(schema, modules);
	const user = backend.withIdentity(userIdentity);
	const response = await user.fetch("/account-deletion", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ password: "test-only", userId: "other" }),
	});
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ status: "accepted" });
	expect(verify.mock.calls[0][0]).toBe(
		"https://api.clerk.com/v1/users/user/verify_password",
	);
	const requests = await backend.run((ctx) =>
		ctx.db.query("accountDeletionRequests").take(10),
	);
	expect(requests).toHaveLength(1);
	expect(requests[0].ownerTokenIdentifier).toBe(userIdentity.tokenIdentifier);
});

test("accepts one idempotent verified internal deletion request", async () => {
	const backend = convexTest(schema, modules);
	const user = backend.withIdentity(userIdentity);
	await user.mutation(api.users.syncCurrentUser, { name: "Delete Me" });

	const first = await user.mutation(
		internal.accountDeletion.enqueueVerifiedDeletion,
		{},
	);
	const second = await user.mutation(
		internal.accountDeletion.enqueueVerifiedDeletion,
		{},
	);

	expect(first).toMatchObject({ status: "accepted" });
	expect(second).toEqual(first);
	const requests = await backend.run((ctx) =>
		ctx.db.query("accountDeletionRequests").take(10),
	);
	expect(requests).toHaveLength(1);
	expect(requests[0]).toMatchObject({
		ownerTokenIdentifier: userIdentity.tokenIdentifier,
		status: "queued",
		stage: "revokeSessions",
		policyVersion: "DAY-357-draft-2026-09-18",
	});
	expect(first.requestId).toMatch(
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
	);
	expect(first.requestId).not.toBe(String(requests[0]._id));
	expect(first.requestId).not.toBe(userIdentity.subject);
});

test("keeps a completed request opaque when no user row existed", async () => {
	const backend = convexTest(schema, modules);
	const user = backend.withIdentity(userIdentity);
	const accepted = await user.mutation(
		internal.accountDeletion.enqueueVerifiedDeletion,
		{},
	);
	expect(accepted.requestId).not.toBe(userIdentity.subject);
	expect(accepted.requestId).not.toBe(userIdentity.tokenIdentifier);
	await backend.run(async (ctx) => {
		const request = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (query) =>
				query.eq("requestId", accepted.requestId),
			)
			.unique();
		if (!request) throw new Error("deletion request missing");
		await ctx.db.patch("accountDeletionRequests", request._id, {
			status: "processing",
			stage: "deleteData",
		});
	});
	expect(
		await backend.mutation(internal.accountDeletion.deleteOwnerDataBatch, {
			requestId: accepted.requestId,
		}),
	).toMatchObject({ done: true });
	expect(
		await backend.mutation(internal.accountDeletion.completeRequest, {
			requestId: accepted.requestId,
		}),
	).toBe(true);
	const requests = await backend.run((ctx) =>
		ctx.db.query("accountDeletionRequests").take(10),
	);
	expect(requests).toHaveLength(1);
	expect(requests[0]).not.toHaveProperty("ownerTokenIdentifier");
	expect(requests[0]).not.toHaveProperty("clerkUserId");
	expect(requests[0].requestId).toBe(accepted.requestId);
});

test("legacy public entry point cannot bypass server verification", async () => {
	const backend = convexTest(schema, modules);
	const staleUser = backend.withIdentity({ ...userIdentity, fva: [0, -1] });

	const result = await staleUser.mutation(
		api.accountDeletion.requestCurrentUserDeletion,
		{},
	);

	expect(result).toEqual({
		clerk_error: {
			type: "forbidden",
			reason: "reverification-error",
			metadata: {
				reverification: { level: "first_factor", afterMinutes: 10 },
			},
		},
	});
	expect(
		await backend.run((ctx) =>
			ctx.db.query("accountDeletionRequests").take(10),
		),
	).toEqual([]);
});

test("revokes application access as soon as deletion is requested", async () => {
	const backend = convexTest(schema, modules);
	const user = backend.withIdentity(userIdentity);
	await user.mutation(api.users.syncCurrentUser, { name: "Delete Me" });
	await user.mutation(internal.accountDeletion.enqueueVerifiedDeletion, {});

	await expect(
		user.mutation(api.users.syncCurrentUser, { name: "Still Here" }),
	).rejects.toThrow("Dieses Konto wird dauerhaft gelöscht");
});

test("deletes account data in bounded internal batches and preserves other users", async () => {
	const backend = convexTest(schema, modules);
	const user = backend.withIdentity(userIdentity);
	const other = backend.withIdentity(otherIdentity);
	const userId = await user.mutation(api.users.syncCurrentUser, {
		name: "Delete Me",
	});
	const otherUserId = await other.mutation(api.users.syncCurrentUser, {
		name: "Keep Me",
	});
	const accepted = await user.mutation(
		internal.accountDeletion.enqueueVerifiedDeletion,
		{},
	);
	if (!("requestId" in accepted)) throw new Error("request not accepted");

	await backend.run(async (ctx) => {
		const request = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (query) =>
				query.eq("requestId", accepted.requestId),
			)
			.unique();
		if (!request) throw new Error("request missing");
		await ctx.db.patch("accountDeletionRequests", request._id, {
			status: "processing",
			stage: "deleteData",
		});

		const questionId = await ctx.db.insert("onboardingQuestions", {
			key: "grade",
			kind: "input",
			order: 0,
			prompt: "Klassenstufe",
		});
		await ctx.db.insert("userOnboardingAnswers", {
			answer: "9",
			questionId,
			userId,
		});
		await ctx.db.insert("userOnboardingAnswers", {
			answer: "10",
			questionId,
			userId: otherUserId,
		});
		for (let index = 0; index < 30; index += 1) {
			await ctx.db.insert("dayEntries", {
				dayKey: `2026-09-${String(index + 1).padStart(2, "0")}`,
				ownerTokenIdentifier: userIdentity.tokenIdentifier,
				title: `Entry ${index + 1}`,
			});
		}
		await ctx.db.insert("dayEntries", {
			dayKey: "2026-10-01",
			ownerTokenIdentifier: otherIdentity.tokenIdentifier,
			title: "Other entry",
		});
		await ctx.db.insert("userLearningTimes", {
			createdAt: 1,
			dayOfWeek: 1,
			endTime: "17:00",
			ownerTokenIdentifier: userIdentity.tokenIdentifier,
			startTime: "16:00",
			updatedAt: 1,
		});
		for (const [id, status] of [
			[userId, "pending"],
			[otherUserId, "review"],
		] as const)
			await ctx.db.insert("crmStudentUpdates", {
				userId: id,
				revision: 1,
				status,
				nextAttemptAt: 1,
				attempts: 0,
			});
	});

	let done = false;
	let batches = 0;
	while (!done) {
		const result = await backend.mutation(
			internal.accountDeletion.deleteOwnerDataBatch,
			{ requestId: accepted.requestId },
		);
		done = result.done;
		batches += 1;
	}
	await backend.mutation(internal.accountDeletion.completeRequest, {
		requestId: accepted.requestId,
	});

	expect(batches).toBeGreaterThan(1);
	const remaining = await backend.run(async (ctx) => ({
		dayEntries: await ctx.db.query("dayEntries").take(100),
		onboardingAnswers: await ctx.db.query("userOnboardingAnswers").take(100),
		requests: await ctx.db.query("accountDeletionRequests").take(10),
		users: await ctx.db.query("users").take(10),
		crmUpdates: await ctx.db.query("crmStudentUpdates").take(100),
	}));
	expect(remaining.dayEntries).toMatchObject([
		{ ownerTokenIdentifier: otherIdentity.tokenIdentifier },
	]);
	expect(remaining.onboardingAnswers).toMatchObject([{ userId: otherUserId }]);
	expect(remaining.users).toMatchObject([
		{ tokenIdentifier: otherIdentity.tokenIdentifier },
	]);
	expect(remaining.crmUpdates).toMatchObject([
		{ userId: otherUserId, status: "review" },
	]);
	expect(remaining.requests[0]).toMatchObject({
		status: "completed",
		stage: "complete",
		deletedRecords: 35,
	});
	expect(remaining.requests[0]).not.toHaveProperty("ownerTokenIdentifier");
	expect(remaining.requests[0]).not.toHaveProperty("clerkUserId");
});

test("moves exhausted retries to manual review without storing raw errors", async () => {
	const backend = convexTest(schema, modules);
	const user = backend.withIdentity(userIdentity);
	await user.mutation(api.users.syncCurrentUser, {});
	const accepted = await user.mutation(
		internal.accountDeletion.enqueueVerifiedDeletion,
		{},
	);
	if (!("requestId" in accepted)) throw new Error("request not accepted");

	for (let attempt = 0; attempt < 8; attempt += 1) {
		await backend.mutation(internal.accountDeletion.markRequestRetry, {
			requestId: accepted.requestId,
			expectedStage: "revokeSessions",
			errorCode: "revokeSessions_http_503",
			nextAttemptAt: 1000 + attempt,
			shouldRetry: attempt < 7,
		});
	}

	const request = await backend.run((ctx) =>
		ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (query) =>
				query.eq("requestId", accepted.requestId),
			)
			.unique(),
	);
	expect(request).toMatchObject({
		attemptCount: 8,
		status: "manualReview",
		lastErrorCode: "revokeSessions_http_503",
	});
	expect(request).not.toHaveProperty("nextAttemptAt");
});

test("rejects account deletion without an authenticated identity", async () => {
	const backend = convexTest(schema, modules);

	await expect(
		backend.mutation(internal.accountDeletion.enqueueVerifiedDeletion, {}),
	).rejects.toThrow("Nicht authentifiziert");
});
