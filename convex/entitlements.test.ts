/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	subject: "clerk_trial_user",
	tokenIdentifier: "https://clerk.example|clerk_trial_user",
	email: "trial@example.com",
	name: "Trial User",
};

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

test("authenticated user activates 14 days of account access", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});

	const access = await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	expect(access).toEqual({
		canUseApp: true,
		reminderAt: Date.parse("2026-08-09T10:00:00.000Z"),
		state: "trial",
		trialExpiresAt: Date.parse("2026-08-11T10:00:00.000Z"),
		trialStartedAt: Date.parse("2026-07-28T10:00:00.000Z"),
		trialTermsVersion: "2026-07-28",
	});
});

test("activating an existing trial never restarts its clock", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	const firstAccess = await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	vi.setSystemTime(new Date("2026-08-05T10:00:00.000Z"));
	const repeatedAccess = await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-08-01",
	});

	expect(repeatedAccess).toEqual(firstAccess);
});

test("authenticated account without an entitlement requires activation", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});

	await expect(
		t.query(api.entitlements.getMyAccess, {
			now: Date.parse("2026-07-28T10:00:00.000Z"),
		}),
	).resolves.toEqual({
		canUseApp: false,
		state: "needsActivation",
	});
});

test("trial access expires exactly 14 days after activation", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	await expect(
		t.query(api.entitlements.getMyAccess, {
			now: Date.parse("2026-08-11T10:00:00.000Z"),
		}),
	).resolves.toMatchObject({
		canUseApp: false,
		state: "expired",
	});
});

test("verified RevenueCat subscription unlocks paid account access", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test_revenuecat");
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			json: async () => ({
				request_date: "2026-07-28T10:00:00Z",
				subscriber: {
					entitlements: {
						dayova_full_access: {
							expires_date: "2026-08-28T10:00:00Z",
							grace_period_expires_date: null,
							product_identifier: "dayova_monthly",
							purchase_date: "2026-07-28T10:00:00Z",
						},
					},
					management_url: "https://apps.apple.com/account/subscriptions",
					subscriptions: {
						dayova_monthly: {
							billing_issues_detected_at: null,
							expires_date: "2026-08-28T10:00:00Z",
							store: "app_store",
							unsubscribe_detected_at: null,
						},
					},
				},
			}),
		})),
	);
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	await t.action(api.revenueCat.syncMyEntitlement, {});

	await expect(
		t.query(api.entitlements.getMyAccess, {
			now: Date.parse("2026-08-12T10:00:00.000Z"),
		}),
	).resolves.toMatchObject({
		canUseApp: true,
		managementUrl: "https://apps.apple.com/account/subscriptions",
		productId: "dayova_monthly",
		state: "paid",
		subscriptionExpiresAt: Date.parse("2026-08-28T10:00:00Z"),
	});
});

test("RevenueCat subscription grace keeps full access during a billing issue", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test_revenuecat");
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			json: async () => ({
				subscriber: {
					entitlements: {
						dayova_full_access: {
							expires_date: "2026-08-10T10:00:00Z",
							grace_period_expires_date: null,
							product_identifier: "dayova_monthly",
						},
					},
					management_url: "https://apps.apple.com/account/subscriptions",
					subscriptions: {
						dayova_monthly: {
							billing_issues_detected_at: "2026-08-10T10:00:00Z",
							expires_date: "2026-08-10T10:00:00Z",
							grace_period_expires_date: "2026-08-13T10:00:00Z",
							store: "app_store",
							unsubscribe_detected_at: null,
						},
					},
				},
			}),
		})),
	);
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	await t.action(api.revenueCat.syncMyEntitlement, {});

	await expect(
		t.query(api.entitlements.getMyAccess, {
			now: Date.parse("2026-08-12T10:00:00.000Z"),
		}),
	).resolves.toMatchObject({
		canUseApp: true,
		state: "billingGrace",
		subscriptionGraceExpiresAt: Date.parse("2026-08-13T10:00:00Z"),
	});
});

test("authorized RevenueCat webhook refreshes access while the app is closed", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test_revenuecat");
	vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "Bearer webhook-secret");
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			json: async () => ({
				subscriber: {
					entitlements: {
						dayova_full_access: {
							expires_date: "2026-09-28T10:00:00Z",
							grace_period_expires_date: null,
							product_identifier: "dayova_annual",
						},
					},
					management_url: "https://play.google.com/store/account/subscriptions",
					subscriptions: {
						dayova_annual: {
							billing_issues_detected_at: null,
							expires_date: "2026-09-28T10:00:00Z",
							store: "play_store",
							unsubscribe_detected_at: null,
						},
					},
				},
			}),
		})),
	);
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	const response = await t.fetch("/revenuecat-webhook", {
		method: "POST",
		headers: {
			Authorization: "Bearer webhook-secret",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			api_version: "1.0",
			event: {
				app_user_id: user.subject,
				entitlement_ids: ["dayova_full_access"],
				id: "evt_initial_purchase",
				type: "INITIAL_PURCHASE",
			},
		}),
	});

	expect(response.status).toBe(200);
	await expect(
		t.query(api.entitlements.getMyAccess, {
			now: Date.parse("2026-08-12T10:00:00.000Z"),
		}),
	).resolves.toMatchObject({
		canUseApp: true,
		productId: "dayova_annual",
		state: "paid",
		store: "play_store",
	});
});

test("RevenueCat webhook rejects requests without the configured authorization", async () => {
	vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "Bearer webhook-secret");
	const t = convexTest(schema, modules);

	const response = await t.fetch("/revenuecat-webhook", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			event: {
				app_user_id: user.subject,
				id: "evt_untrusted",
				type: "INITIAL_PURCHASE",
			},
		}),
	});

	expect(response.status).toBe(401);
});

test("activating an expired entitlement preserves its real access state", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	vi.setSystemTime(new Date("2026-08-12T10:00:00.000Z"));
	await expect(
		t.mutation(api.entitlements.activateMyTrial, {
			termsVersion: "2026-08-12",
		}),
	).resolves.toMatchObject({
		canUseApp: false,
		state: "expired",
	});
});

test("RevenueCat webhook returns 503 when subscriber synchronization fails", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test_revenuecat");
	vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "Bearer webhook-secret");
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => Promise.reject(new Error("offline"))),
	);
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	const response = await t.fetch("/revenuecat-webhook", {
		method: "POST",
		headers: {
			Authorization: "Bearer webhook-secret",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			event: {
				app_user_id: user.subject,
				id: "evt_sync_failure",
				type: "RENEWAL",
			},
		}),
	});

	expect(response.status).toBe(503);
});

test("Day 12 creates an in-app trial reminder exactly once", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-07-28",
	});

	await t.finishAllScheduledFunctions(() => {
		vi.advanceTimersByTime(12 * 24 * 60 * 60 * 1000);
	});
	const inbox = await t.query(api.notifications.listInbox, {
		category: "all",
	});

	expect(inbox).toMatchObject([
		{
			body: "Deine kostenlose Testphase endet in 2 Tagen. Danach entscheidest du selbst, wie es weitergeht.",
			category: "message",
			title: "Deine Testphase endet bald",
			type: "trialEnding",
		},
	]);
});
