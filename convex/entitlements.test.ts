/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Exercise server time independently of ignored legacy query hints.
async function accessAt(
	t: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
	now: number,
) {
	if (!vi.isFakeTimers()) vi.useFakeTimers();
	vi.setSystemTime(now);
	await t.mutation(api.accessState.refreshMyAccess, {});
	return await t.query(api.entitlements.getMyAccess, { now: 0 });
}
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

test("authenticated user activates 30 days of account access", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});

	const access = await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-10-16-30d-v1",
	});

	expect(access).toEqual({
		canUseApp: true,
		reminderAt: Date.parse("2026-08-25T10:00:00.000Z"),
		state: "trial",
		trialExpiresAt: Date.parse("2026-08-27T10:00:00.000Z"),
		trialStartedAt: Date.parse("2026-07-28T10:00:00.000Z"),
		trialTermsVersion: "2026-10-16-30d-v1",
	});
});

test.each([
	"2026-07-28-v1",
	"30d",
	"",
	"2026-10-16-30d-v2",
])("first activation rejects unsupported terms %j without granting access", async (termsVersion) => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});

	await expect(
		t.mutation(api.entitlements.activateMyTrial, { termsVersion }),
	).rejects.toMatchObject({
		data: {
			kind: "userFacing",
			message:
				"Bitte aktualisiere Dayova und akzeptiere die aktuellen Nutzungsbedingungen, um deine Testphase zu starten.",
		},
	});
	await expect(
		accessAt(t, Date.parse("2026-10-21T12:00:00.000Z")),
	).resolves.toEqual({ canUseApp: false, state: "needsActivation" });

	await expect(
		t.mutation(api.entitlements.activateMyTrial, {
			termsVersion: "2026-10-16-30d-v1",
		}),
	).resolves.toMatchObject({
		state: "trial",
		canUseApp: true,
		trialTermsVersion: "2026-10-16-30d-v1",
		trialStartedAt: Date.parse("2026-10-21T12:00:00.000Z"),
		trialExpiresAt: Date.parse("2026-11-20T12:00:00.000Z"),
		reminderAt: Date.parse("2026-11-18T12:00:00.000Z"),
	});
});
test("activating an existing trial never restarts its clock", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	const firstAccess = await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-10-16-30d-v1",
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
		accessAt(t, Date.parse("2026-07-28T10:00:00.000Z")),
	).resolves.toEqual({
		canUseApp: false,
		state: "needsActivation",
	});
});

test.each([
	["2026-10-21T12:00:00.000Z", "2026-11-20T12:00:00.000Z"],
	["2026-03-15T12:00:00.000Z", "2026-04-14T12:00:00.000Z"],
	["2028-02-01T23:59:59.000Z", "2028-03-02T23:59:59.000Z"],
])("30 full days from %s expire at %s regardless of calendar boundaries", async (start, end) => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(start));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-10-16-30d-v1",
	});
	await expect(accessAt(t, Date.parse(end) - 1)).resolves.toMatchObject({
		state: "trial",
		canUseApp: true,
		trialExpiresAt: Date.parse(end),
	});
	await expect(accessAt(t, Date.parse(end))).resolves.toMatchObject({
		state: "expired",
		canUseApp: false,
	});
});

test.each([
	{
		name: "running 14-day trial",
		start: "2026-10-10T12:00:00.000Z",
		end: "2026-10-24T12:00:00.000Z",
		paid: false,
		state: "trial",
	},
	{
		name: "expired 14-day trial",
		start: "2026-10-06T12:00:00.000Z",
		end: "2026-10-20T12:00:00.000Z",
		paid: false,
		state: "expired",
	},
	{
		name: "manual extension",
		start: "2026-10-06T12:00:00.000Z",
		end: "2026-12-31T12:00:00.000Z",
		paid: false,
		state: "trial",
	},
	{
		name: "paid account",
		start: "2026-10-06T12:00:00.000Z",
		end: "2026-10-20T12:00:00.000Z",
		paid: true,
		state: "paid",
	},
])("activation preserves the stored $name", async ({
	start,
	end,
	paid,
	state,
}) => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	const before = await t.run(async (ctx) => {
		const account = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", user.tokenIdentifier),
			)
			.unique();
		if (!account) throw new Error("Missing test account");
		const id = await ctx.db.insert("accessEntitlements", {
			userId: account._id,
			ownerTokenIdentifier: user.tokenIdentifier,
			trialStartedAt: Date.parse(start),
			trialExpiresAt: Date.parse(end),
			trialReminderAt: Date.parse(end) - 172_800_000,
			trialTermsVersion: "legacy-14d",
			revenueCatEntitlementActive: paid,
			...(paid
				? { subscriptionExpiresAt: Date.parse("2026-12-01T12:00:00.000Z") }
				: {}),
			createdAt: 1,
			updatedAt: 1,
		});
		return ctx.db.get("accessEntitlements", id);
	});
	if (!before) throw new Error("Missing seeded entitlement");
	for (const termsVersion of ["2026-07-28-v1", "2026-10-16-30d-v1"]) {
		await expect(
			t.mutation(api.entitlements.activateMyTrial, { termsVersion }),
		).resolves.toMatchObject({ state, canUseApp: state !== "expired" });
	}
	const after = await t.run((ctx) =>
		ctx.db.get("accessEntitlements", before._id),
	);
	if (!after) throw new Error("Missing preserved entitlement");
	const {
		accessEvaluatedAt: _evaluated,
		accessCheckAt: _check,
		...storedPolicy
	} = after;
	expect(storedPolicy).toEqual(before);
});

test("CRM receives the same new trial deadline and expiry state as the app", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-10-16-30d-v1",
	});
	const inspect = (now: string) =>
		t.query(internal.crmSyncState.inspectStudent, {
			clerkId: user.subject,
			pageId: "synthetic-crm-page",
			now: Date.parse(now),
		});
	await expect(inspect("2026-11-20T11:59:59.999Z")).resolves.toMatchObject({
		status: "matched",
		projection: {
			state: "trial",
			trialStartedAt: Date.parse("2026-10-21T12:00:00.000Z"),
			trialExpiresAt: Date.parse("2026-11-20T12:00:00.000Z"),
		},
	});
	await expect(inspect("2026-11-20T12:00:00.000Z")).resolves.toMatchObject({
		status: "matched",
		projection: { state: "expired" },
	});
});

test("trial access expires exactly 30 days after activation", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-10-16-30d-v1",
	});

	await expect(
		accessAt(t, Date.parse("2026-08-27T10:00:00.000Z")),
	).resolves.toMatchObject({
		canUseApp: false,
		state: "expired",
	});
});

test("verified RevenueCat subscription unlocks a new account without starting a trial", async () => {
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

	await t.action(api.revenueCat.syncMyEntitlement, {});

	await expect(
		accessAt(t, Date.parse("2026-08-12T10:00:00.000Z")),
	).resolves.toMatchObject({
		canUseApp: true,
		managementUrl: "https://apps.apple.com/account/subscriptions",
		productId: "dayova_monthly",
		state: "paid",
		subscriptionExpiresAt: Date.parse("2026-08-28T10:00:00Z"),
	});
	const storedEntitlement = await t.run(async (ctx) =>
		ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", user.tokenIdentifier),
			)
			.unique(),
	);
	expect(storedEntitlement).not.toHaveProperty("trialStartedAt");
	expect(storedEntitlement).not.toHaveProperty("trialExpiresAt");
	await expect(
		accessAt(t, Date.parse("2026-08-29T10:00:00.000Z")),
	).resolves.toMatchObject({
		canUseApp: false,
		state: "expired",
		subscriptionExpiresAt: Date.parse("2026-08-28T10:00:00Z"),
	});
});

test("RevenueCat web billing does not unlock mobile app access", async () => {
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
							expires_date: "2026-08-28T10:00:00Z",
							product_identifier: "dayova_monthly_web",
						},
					},
					management_url: "https://dayova.com/account",
					subscriptions: {
						dayova_monthly_web: {
							expires_date: "2026-08-28T10:00:00Z",
							store: "rc_billing",
						},
					},
				},
			}),
		})),
	);
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});

	await expect(t.action(api.revenueCat.syncMyEntitlement, {})).resolves.toEqual(
		{
			active: false,
		},
	);
	await expect(
		accessAt(t, Date.parse("2026-08-12T10:00:00.000Z")),
	).resolves.toEqual({
		canUseApp: false,
		state: "needsActivation",
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
		termsVersion: "2026-10-16-30d-v1",
	});

	await t.action(api.revenueCat.syncMyEntitlement, {});

	await expect(
		accessAt(t, Date.parse("2026-08-12T10:00:00.000Z")),
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
		termsVersion: "2026-10-16-30d-v1",
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
		accessAt(t, Date.parse("2026-08-12T10:00:00.000Z")),
	).resolves.toMatchObject({
		canUseApp: true,
		productId: "dayova_annual",
		state: "paid",
		store: "play_store",
	});
});

test("TRANSFER webhook grants the destination and revokes the source account", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test_revenuecat");
	vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "Bearer webhook-secret");
	const sourceUser = {
		subject: "clerk_transfer_source",
		tokenIdentifier: "https://clerk.example|clerk_transfer_source",
		email: "source@example.com",
		name: "Source User",
	};
	let transferCompleted = false;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			const isDestination = url.includes(encodeURIComponent(user.subject));
			const isActive = transferCompleted ? isDestination : !isDestination;
			return {
				ok: true,
				json: async () => ({
					subscriber: {
						entitlements: isActive
							? {
									dayova_full_access: {
										expires_date: "2026-09-28T10:00:00Z",
										grace_period_expires_date: null,
										product_identifier: "dayova_annual",
									},
								}
							: {},
						management_url: null,
						subscriptions: isActive
							? {
									dayova_annual: {
										billing_issues_detected_at: null,
										expires_date: "2026-09-28T10:00:00Z",
										store: "app_store",
										unsubscribe_detected_at: null,
									},
								}
							: {},
					},
				}),
			};
		}),
	);
	const backend = convexTest(schema, modules);
	const source = backend.withIdentity(sourceUser);
	const destination = backend.withIdentity(user);
	for (const client of [source, destination]) {
		await client.mutation(api.users.syncCurrentUser, {});
		await client.mutation(api.entitlements.activateMyTrial, {
			termsVersion: "2026-10-16-30d-v1",
		});
	}
	await source.action(api.revenueCat.syncMyEntitlement, {});

	transferCompleted = true;
	const response = await backend.fetch("/revenuecat-webhook", {
		method: "POST",
		headers: {
			Authorization: "Bearer webhook-secret",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			event: {
				id: "evt_transfer_accounts",
				transferred_from: [sourceUser.subject],
				transferred_to: [user.subject],
				type: "TRANSFER",
			},
		}),
	});

	expect(response.status).toBe(200);
	await expect(
		accessAt(destination, Date.parse("2026-08-28T10:00:00.000Z")),
	).resolves.toMatchObject({ canUseApp: true, state: "paid" });
	await expect(
		accessAt(source, Date.parse("2026-08-28T10:00:00.000Z")),
	).resolves.toMatchObject({ canUseApp: false, state: "expired" });
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
		termsVersion: "2026-10-16-30d-v1",
	});

	vi.setSystemTime(new Date("2026-08-28T10:00:00.000Z"));
	await expect(
		t.mutation(api.entitlements.activateMyTrial, {
			termsVersion: "2026-08-28",
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
		termsVersion: "2026-10-16-30d-v1",
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

test("Day 28 creates an in-app trial reminder exactly once", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "2026-10-16-30d-v1",
	});

	// convex-test uses setTimeout, whose maximum delay is less than 28 days.
	// Verify the persisted scheduler deadline, then exercise its callback at that time.
	const scheduled = await t.run((ctx) =>
		ctx.db.system.query("_scheduled_functions").take(10),
	);
	expect(scheduled).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				name: "entitlements:deliverTrialReminder",
				args: [
					{
						expectedTrialExpiresAt: Date.parse("2026-08-27T10:00:00.000Z"),
						ownerTokenIdentifier: user.tokenIdentifier,
					},
				],
				scheduledTime: Date.parse("2026-08-25T10:00:00.000Z"),
			}),
		]),
	);
	expect(
		await t.query(api.notifications.listInbox, { category: "all" }),
	).toEqual([]);
	vi.setSystemTime(new Date("2026-08-25T10:00:00.000Z"));
	for (let delivery = 0; delivery < 2; delivery++) {
		await t.mutation(internal.entitlements.deliverTrialReminder, {
			expectedTrialExpiresAt: Date.parse("2026-08-27T10:00:00.000Z"),
			ownerTokenIdentifier: user.tokenIdentifier,
		});
	}
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
