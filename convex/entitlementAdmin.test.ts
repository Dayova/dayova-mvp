/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

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
	).resolves.toEqual({ extendedCount: 1 });

	await t.run(async (ctx) => {
		expect((await ctx.db.get(expiredTrialId))?.trialExpiresAt).toBe(
			targetExpiry,
		);
		expect((await ctx.db.get(activeTrialId))?.trialExpiresAt).toBe(
			Date.parse("2026-10-10T12:00:00.000Z"),
		);
		expect((await ctx.db.get(paidTrialId))?.trialExpiresAt).toBe(
			Date.parse("2026-09-15T12:00:00.000Z"),
		);
	});
	vi.useRealTimers();
});
