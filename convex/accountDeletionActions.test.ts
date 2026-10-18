/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

test.each([
	"ownerTokenIdentifier",
	"clerkUserId",
] as const)("legacy requests missing %s stop before provider or data deletion", async (missing) => {
	const backend = convexTest(schema, modules);
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);
	vi.stubEnv("CLERK_SECRET_KEY", "test-server-key");
	await backend.run((ctx) =>
		ctx.db.insert("accountDeletionRequests", {
			requestId: "missing-identity",
			ownerTokenIdentifier: "test:user",
			clerkUserId: "test-user",
			[missing]: undefined,
			status: "queued",
			stage: "revokeSessions",
			attemptCount: 0,
			deletedRecords: 0,
			policyVersion: "legacy-policy",
			requestedAt: 1000,
			updatedAt: 1000,
		}),
	);
	await backend.action(internal.accountDeletionActions.processDeletionRequest, {
		requestId: "missing-identity",
	});
	expect(
		await backend.query(internal.accountDeletion.getRequestForProcessing, {
			requestId: "missing-identity",
		}),
	).toMatchObject({
		status: "manualReview",
		stage: "revokeSessions",
		lastErrorCode: "legacy_identity_missing",
		deletedRecords: 0,
		policyVersion: "legacy-policy",
	});
	expect(fetch).not.toHaveBeenCalled();
	expect(
		await backend.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").take(1),
		),
	).toHaveLength(0);
});

test("competing final data batches schedule only one Notion continuation", async () => {
	vi.useFakeTimers();
	const backend = convexTest(schema, modules);
	await backend.run((ctx) =>
		ctx.db.insert("accountDeletionRequests", {
			requestId: "competing-data-workers",
			ownerTokenIdentifier: "test:user",
			clerkUserId: "test-user",
			crmDataSourceId: "test-source",
			status: "processing",
			stage: "deleteData",
			attemptCount: 0,
			deletedRecords: 0,
			policyVersion: "test",
			requestedAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);
	await Promise.all([
		backend.action(internal.accountDeletionActions.processDeletionRequest, {
			requestId: "competing-data-workers",
		}),
		backend.action(internal.accountDeletionActions.processDeletionRequest, {
			requestId: "competing-data-workers",
		}),
	]);
	const scheduled = await backend.run((ctx) =>
		ctx.db.system.query("_scheduled_functions").take(10),
	);
	expect(scheduled).toHaveLength(1);
	expect(
		await backend.query(internal.accountDeletion.getRequestForProcessing, {
			requestId: "competing-data-workers",
		}),
	).toMatchObject({ stage: "deleteNotion" });
});

test.each([
	["revokeSessions", "deleteClerkIdentity", []],
	["deleteClerkIdentity", "deleteRevenueCat", {}],
	["deleteRevenueCat", "deletePostHog", {}],
	["deletePostHog", "deleteData", { results: [] }],
] as const)("competing %s workers schedule only one continuation", async (stage, nextStage, payload) => {
	vi.useFakeTimers();
	vi.stubEnv("CLERK_SECRET_KEY", "test-server-key");
	vi.stubEnv("REVENUECAT_SECRET_API_KEY", "test-revenuecat-key");
	vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "test-posthog-key");
	vi.stubEnv("POSTHOG_PROJECT_ID", "test-project");
	// Hold both provider calls until both actions have read the same stage.
	let release: () => void = () => undefined;
	const bothStarted = new Promise<void>((resolve) => {
		release = resolve;
	});
	let arrivals = 0;
	const provider = vi.fn(async () => {
		arrivals += 1;
		if (arrivals === 2) release();
		await bothStarted;
		return Response.json(payload);
	});
	vi.stubGlobal("fetch", provider);
	const backend = convexTest(schema, modules);
	await backend.run((ctx) =>
		ctx.db.insert("accountDeletionRequests", {
			requestId: "competing-workers",
			ownerTokenIdentifier: "test:user",
			clerkUserId: "test-user",
			crmDataSourceId: "test-source",
			status: "processing",
			stage,
			attemptCount: 0,
			deletedRecords: 0,
			policyVersion: "test",
			requestedAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);

	await Promise.all([
		backend.action(internal.accountDeletionActions.processDeletionRequest, {
			requestId: "competing-workers",
		}),
		backend.action(internal.accountDeletionActions.processDeletionRequest, {
			requestId: "competing-workers",
		}),
	]);

	const state = await backend.run(async (ctx) => ({
		request: await ctx.db.query("accountDeletionRequests").first(),
		scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
	}));
	expect(provider).toHaveBeenCalledTimes(2);
	expect(state.request).toMatchObject({ stage: nextStage, attemptCount: 0 });
	expect(state.scheduled).toHaveLength(1);
});
