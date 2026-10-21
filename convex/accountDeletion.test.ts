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

test("expires only completed audits after 30 days, preserving unresolved debugging data", async () => {
	const backend = convexTest(schema, modules);
	const day = 24 * 60 * 60 * 1000;
	const now = Date.now();
	await backend.run(async (ctx) => {
		const base = {
			stage: "complete" as const,
			status: "completed" as const,
			attemptCount: 0,
			deletedRecords: 5,
			policyVersion: "DAY-357-draft-2026-09-18",
			requestedAt: now - 400 * day,
			updatedAt: now - 31 * day,
		};
		await ctx.db.insert("accountDeletionRequests", {
			...base,
			requestId: "expired-audit",
			completedAt: now - 30 * day,
		});
		await ctx.db.insert("accountDeletionRequests", {
			...base,
			requestId: "recent-completion",
			completedAt: now - 29 * day,
		});
		for (const status of [
			"queued",
			"processing",
			"retryScheduled",
			"manualReview",
		] as const) {
			await ctx.db.insert("accountDeletionRequests", {
				...base,
				requestId: status,
				status,
				stage: "deletePostHog",
				lastErrorCode: "deletePostHog_http_503",
				ownerTokenIdentifier: `test:${status}`,
			});
		}
	});
	expect(
		await backend.mutation(internal.accountDeletion.purgeCompletedAudits, {}),
	).toBe(1);
	const remaining = await backend.run((ctx) =>
		ctx.db.query("accountDeletionRequests").take(10),
	);
	expect(remaining.map((row) => row.requestId)).toEqual([
		"recent-completion",
		"queued",
		"processing",
		"retryScheduled",
		"manualReview",
	]);
	expect(
		remaining
			.slice(1)
			.every((row) => row.lastErrorCode === "deletePostHog_http_503"),
	).toBe(true);
});

test("purges completed audit backlogs in bounded repeatable batches", async () => {
	const backend = convexTest(schema, modules);
	await backend.run(async (ctx) => {
		for (let index = 0; index < 101; index++) {
			await ctx.db.insert("accountDeletionRequests", {
				requestId: `expired-${index}`,
				status: "completed",
				stage: "complete",
				attemptCount: 0,
				deletedRecords: 0,
				policyVersion: "old-policy",
				requestedAt: 1,
				updatedAt: 2,
				completedAt: 2,
			});
		}
	});
	expect(
		await backend.mutation(internal.accountDeletion.purgeCompletedAudits, {}),
	).toBe(100);
	expect(
		await backend.mutation(internal.accountDeletion.purgeCompletedAudits, {}),
	).toBe(1);
	expect(
		await backend.mutation(internal.accountDeletion.purgeCompletedAudits, {}),
	).toBe(0);
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
		policyVersion: "DAY-357-approved-2026-10-18",
	});
	expect(first.requestId).toMatch(
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
	);
	expect(first.requestId).not.toBe(String(requests[0]._id));
	expect(first.requestId).not.toBe(userIdentity.subject);
});

test("repeated acceptance preserves a legacy request's original deletion barrier time", async () => {
	const backend = convexTest(schema, modules);
	await backend.run((ctx) =>
		ctx.db.insert("accountDeletionRequests", {
			requestId: "legacy-acceptance",
			ownerTokenIdentifier: userIdentity.tokenIdentifier,
			clerkUserId: userIdentity.subject,
			status: "manualReview",
			stage: "deleteNotion",
			attemptCount: 3,
			deletedRecords: 5,
			policyVersion: "legacy-policy",
			requestedAt: 1000,
			updatedAt: 2000,
		}),
	);
	expect(
		await backend
			.withIdentity(userIdentity)
			.mutation(internal.accountDeletion.enqueueVerifiedDeletion, {}),
	).toEqual({ status: "accepted", requestId: "legacy-acceptance" });
	expect(
		await backend.run((ctx) => ctx.db.query("clerkIdentities").unique()),
	).toMatchObject({
		tokenIdentifier: userIdentity.tokenIdentifier,
		clerkId: userIdentity.subject,
		deletedAt: 1000,
	});
	expect(
		await backend.query(internal.accountDeletion.getRequestForProcessing, {
			requestId: "legacy-acceptance",
		}),
	).toMatchObject({
		status: "manualReview",
		policyVersion: "legacy-policy",
		requestedAt: 1000,
	});
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
	await backend.mutation(internal.accountDeletion.advanceRequestStage, {
		requestId: accepted.requestId,
		expectedStage: "deleteData",
		nextStage: "deleteNotion",
	});
	await backend.run(async (ctx) => {
		const request = await ctx.db.query("accountDeletionRequests").unique();
		if (request)
			await ctx.db.patch("accountDeletionRequests", request._id, {
				crmDeletionVerified: true,
			});
	});
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

		for (const owner of [userId, otherUserId]) {
			await ctx.db.insert("contactConsentEvents", {
				userId: owner,
				phone: "+4915123456789",
				feedback: true,
				news: false,
				version: "test",
				revision: 1,
				updatedAt: Date.now(),
				source: "settings",
			});
		}
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
		await ctx.db.insert("personalSubjects", {
			ownerTokenIdentifier: userIdentity.tokenIdentifier,
			name: "Französisch",
			normalizedName: "französisch",
			createdAt: 1,
			updatedAt: 1,
		});
		await ctx.db.insert("personalSubjects", {
			ownerTokenIdentifier: otherIdentity.tokenIdentifier,
			name: "Latein",
			normalizedName: "latein",
			createdAt: 1,
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
	await backend.mutation(internal.accountDeletion.advanceRequestStage, {
		requestId: accepted.requestId,
		expectedStage: "deleteData",
		nextStage: "deleteNotion",
	});
	await backend.run(async (ctx) => {
		const request = await ctx.db.query("accountDeletionRequests").unique();
		if (request)
			await ctx.db.patch("accountDeletionRequests", request._id, {
				crmDeletionVerified: true,
			});
	});
	await backend.mutation(internal.accountDeletion.completeRequest, {
		requestId: accepted.requestId,
	});

	expect(batches).toBeGreaterThan(1);
	const remaining = await backend.run(async (ctx) => ({
		dayEntries: await ctx.db.query("dayEntries").take(100),
		personalSubjects: await ctx.db.query("personalSubjects").take(100),
		personalSubjectReferences: await ctx.db
			.query("personalSubjectReferences")
			.take(100),
		contactEvents: await ctx.db.query("contactConsentEvents").take(100),
		onboardingAnswers: await ctx.db.query("userOnboardingAnswers").take(100),
		requests: await ctx.db.query("accountDeletionRequests").take(10),
		users: await ctx.db.query("users").take(10),
		crmUpdates: await ctx.db.query("crmStudentUpdates").take(100),
	}));
	expect(remaining.dayEntries).toMatchObject([
		{ ownerTokenIdentifier: otherIdentity.tokenIdentifier },
	]);
	expect(remaining.personalSubjects).toMatchObject([
		{ ownerTokenIdentifier: otherIdentity.tokenIdentifier, name: "Latein" },
	]);
	expect(remaining.personalSubjectReferences).toEqual([]);
	expect(remaining.onboardingAnswers).toMatchObject([{ userId: otherUserId }]);
	expect(remaining.contactEvents).toMatchObject([{ userId: otherUserId }]);
	expect(remaining.users).toMatchObject([
		{ tokenIdentifier: otherIdentity.tokenIdentifier },
	]);
	expect(remaining.crmUpdates).toMatchObject([
		{ userId: otherUserId, status: "review" },
	]);
	expect(remaining.requests[0]).toMatchObject({
		status: "completed",
		stage: "complete",
		deletedRecords: 37,
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

test("concurrent verified requests share one tombstone and keep access blocked after failure", async () => {
	vi.useFakeTimers();
	try {
		const backend = convexTest(schema, modules);
		const user = backend.withIdentity(userIdentity);
		await user.mutation(api.users.syncCurrentUser, { name: "Delete Me" });
		const requests = await Promise.all([
			user.mutation(internal.accountDeletion.enqueueVerifiedDeletion, {}),
			user.mutation(internal.accountDeletion.enqueueVerifiedDeletion, {}),
		]);
		expect(requests[0]).toMatchObject({ status: "accepted" });
		expect(requests[1]).toEqual(requests[0]);
		const records = await backend.run((ctx) =>
			ctx.db.query("accountDeletionRequests").take(10),
		);
		expect(records).toHaveLength(1);
		expect(records[0].requestId).toBe(requests[0].requestId);

		await backend.mutation(internal.accountDeletion.markRequestRetry, {
			requestId: requests[0].requestId,
			expectedStage: "revokeSessions",
			errorCode: "revokeSessions_http_503",
			nextAttemptAt: Date.now() + 60_000,
			shouldRetry: true,
		});
		await expect(user.query(api.users.getMe, {})).rejects.toThrow(
			"Dieses Konto wird dauerhaft gelöscht",
		);
		await expect(
			user.mutation(api.users.syncCurrentUser, { name: "Still Here" }),
		).rejects.toThrow("Dieses Konto wird dauerhaft gelöscht");
		expect(
			await backend.query(internal.accountDeletion.getRequestForProcessing, {
				requestId: requests[0].requestId,
			}),
		).toMatchObject({ status: "retryScheduled", attemptCount: 1 });
	} finally {
		vi.clearAllTimers();
		vi.useRealTimers();
	}
});
