/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob("./**/*.ts");
const owner = "https://clerk.example|trial-user";
const targetExpiry = Date.parse("2026-10-31T22:59:59.999Z");

test("extends only expired trials without active paid access", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
	const t = convexTest(schema, modules);
	const userId = await t.run(async (ctx) =>
		ctx.db.insert("users", {
			tokenIdentifier: owner,
			clerkId: "trial-user",
			email: "trial@example.com",
		}),
	);
	const expiredTrialId = await t.run(async (ctx) =>
		ctx.db.insert("accessEntitlements", {
			ownerTokenIdentifier: owner,
			userId,
			trialStartedAt: Date.parse("2026-09-01T12:00:00.000Z"),
			trialExpiresAt: Date.parse("2026-09-15T12:00:00.000Z"),
			trialReminderAt: Date.parse("2026-09-13T12:00:00.000Z"),
			trialTermsVersion: "2026-09-01",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);
	const activeTrialId = await t.run(async (ctx) =>
		ctx.db.insert("accessEntitlements", {
			ownerTokenIdentifier: "https://clerk.example|active-trial",
			userId,
			trialStartedAt: Date.now(),
			trialExpiresAt: Date.parse("2026-10-10T12:00:00.000Z"),
			trialReminderAt: Date.parse("2026-10-08T12:00:00.000Z"),
			trialTermsVersion: "2026-09-30",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);
	const paidTrialId = await t.run(async (ctx) =>
		ctx.db.insert("accessEntitlements", {
			ownerTokenIdentifier: "https://clerk.example|paid-user",
			userId,
			trialStartedAt: Date.parse("2026-09-01T12:00:00.000Z"),
			trialExpiresAt: Date.parse("2026-09-15T12:00:00.000Z"),
			trialReminderAt: Date.parse("2026-09-13T12:00:00.000Z"),
			trialTermsVersion: "2026-09-01",
			revenueCatEntitlementActive: true,
			subscriptionExpiresAt: Date.parse("2026-10-15T12:00:00.000Z"),
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);

	await expect(
		t.mutation(internal.entitlementAdmin.extendExpiredTrials, {
			expiresAt: targetExpiry,
		}),
	).resolves.toEqual({ extendedCount: 1, continuationScheduled: false });

	await t.run(async (ctx) => {
		expect(
			(await ctx.db.get("accessEntitlements", expiredTrialId))?.trialExpiresAt,
		).toBe(targetExpiry);
		expect(
			(await ctx.db.get("accessEntitlements", activeTrialId))?.trialExpiresAt,
		).toBe(Date.parse("2026-10-10T12:00:00.000Z"));
		expect(
			(await ctx.db.get("accessEntitlements", paidTrialId))?.trialExpiresAt,
		).toBe(Date.parse("2026-09-15T12:00:00.000Z"));
	});
	await expect(
		t.mutation(internal.entitlementAdmin.extendExpiredTrials, {
			expiresAt: targetExpiry,
		}),
	).resolves.toEqual({ extendedCount: 0, continuationScheduled: false });
});

test.each([
	NaN,
	Infinity,
	-Infinity,
	0,
	Date.parse("2026-09-30T12:00:00Z"),
])("rejects invalid or nonfuture expiry %s", async (expiresAt) => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
	const t = convexTest(schema, modules);
	await expect(
		t.mutation(internal.entitlementAdmin.extendExpiredTrials, { expiresAt }),
	).rejects.toThrow("Trial expiry must be a finite future timestamp");
});

test("continues across bounded batches and excludes trials active at the initial cutoff", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
	const t = convexTest(schema, modules);
	const cutoff = Date.now();
	const ids = await t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			tokenIdentifier: owner,
			clerkId: "trial-user",
			email: "trial@example.com",
		});
		const ids = [];
		for (let i = 0; i < 205; i++) {
			ids.push(
				await ctx.db.insert("accessEntitlements", {
					ownerTokenIdentifier: `${owner}-${i}`,
					userId,
					trialExpiresAt: i === 204 ? cutoff + 1000 : cutoff - 1000,
					createdAt: cutoff,
					updatedAt: cutoff,
				}),
			);
		}
		return ids;
	});
	const first = await t.mutation(
		internal.entitlementAdmin.extendExpiredTrials,
		{ expiresAt: targetExpiry },
	);
	expect(first).toEqual({ extendedCount: 100, continuationScheduled: true });
	vi.setSystemTime(cutoff + 2000);
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	await t.run(async (ctx) => {
		for (const id of ids.slice(0, 204))
			expect((await ctx.db.get("accessEntitlements", id))?.trialExpiresAt).toBe(
				targetExpiry,
			);
		expect(
			(await ctx.db.get("accessEntitlements", ids[204]))?.trialExpiresAt,
		).toBe(cutoff + 1000);
	});
});
