/// <reference types="vite/client" />
import { runToCompletion } from "@convex-dev/migrations";
import migrationsTest from "@convex-dev/migrations/test";
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
test("the real resumable migration initializes only derived access and preserves every cohort deadline", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
	const t = convexTest(schema, modules);
	migrationsTest.register(t);
	const cohorts = [
		{ owner: "legacy-active", end: "2026-10-24T12:00:00Z", state: "trial" },
		{ owner: "legacy-expired", end: "2026-10-20T12:00:00Z", state: "expired" },
		{ owner: "extended", end: "2026-12-31T12:00:00Z", state: "trial" },
		{ owner: "paid", end: "2026-10-20T12:00:00Z", state: "paid", paid: true },
	];
	for (const cohort of cohorts)
		await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				clerkId: cohort.owner,
				tokenIdentifier: cohort.owner,
				email: cohort.owner + "@example.invalid",
			});
			await ctx.db.insert("accessEntitlements", {
				ownerTokenIdentifier: cohort.owner,
				userId,
				trialStartedAt: Date.parse("2026-10-10T12:00:00Z"),
				trialExpiresAt: Date.parse(cohort.end),
				trialReminderAt: Date.parse("2026-10-18T12:00:00Z"),
				trialTermsVersion: "legacy-14d",
				revenueCatEntitlementActive: cohort.paid,
				subscriptionExpiresAt: cohort.paid
					? Date.parse("2026-12-01T12:00:00Z")
					: undefined,
				createdAt: 1,
				updatedAt: 1,
			});
		});
	const before = await t.run((ctx) =>
		ctx.db.query("accessEntitlements").take(10),
	);
	expect(before).toHaveLength(4);
	await t.run((ctx) =>
		runToCompletion(
			ctx,
			components.migrations,
			internal.accessMigrations.initializeAccessProjection,
		),
	);
	for (const cohort of cohorts)
		await expect(
			t
				.withIdentity({ tokenIdentifier: cohort.owner })
				.query(api.entitlements.getMyAccess, { now: 0 }),
		).resolves.toMatchObject({ state: cohort.state });
	const after = await t.run((ctx) =>
		ctx.db.query("accessEntitlements").take(10),
	);
	expect(after).toHaveLength(4);
	expect(
		after.map(
			({ accessEvaluatedAt: _clock, accessCheckAt: _next, ...policy }) =>
				policy,
		),
	).toEqual(before);
	await t.run((ctx) =>
		runToCompletion(
			ctx,
			components.migrations,
			internal.accessMigrations.initializeAccessProjection,
		),
	);
	expect(
		await t.run((ctx) => ctx.db.query("accessEntitlements").take(10)),
	).toEqual(after);
});
