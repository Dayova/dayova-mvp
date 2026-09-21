/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = {
	subject: "crm_billing_test",
	tokenIdentifier: "issuer|crm_billing_test",
	email: "billing@example.com",
};
const now = Date.parse("2026-09-21T12:00:00Z");
const tomorrow = now + 86400_000;
const pageId = "11111111-1111-4111-8111-111111111111";
const monthly = "com.dayova.abonnement.monthly";
const annual = "com.dayova.abonnemment.yearly";
const trial = {
	trialStartedAt: now - 1000,
	trialExpiresAt: tomorrow,
	trialReminderAt: now + 1000,
	trialTermsVersion: "test",
};
type Entitlement = Partial<Doc<"accessEntitlements">>;
type Scenario = [string, Entitlement, string, string];

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

test.each<Scenario>([
	["active iOS monthly", {}, "Paid", "Monthly"],
	["iOS annual", { subscriptionProductId: annual }, "Paid", "Annual"],
	[
		"Android monthly",
		{
			subscriptionStore: "play_store",
			subscriptionProductId: "dayova_monthly:monthly-autorenewing",
		},
		"Paid",
		"Monthly",
	],
	[
		"Android annual",
		{
			subscriptionStore: "play_store",
			subscriptionProductId: "dayova_annual:annual-autorenewing",
		},
		"Paid",
		"Annual",
	],
	[
		"Android subscription ID",
		{
			subscriptionStore: "play_store",
			subscriptionProductId: "dayova_monthly",
		},
		"Paid",
		"Monthly",
	],
	[
		"unknown product",
		{ subscriptionProductId: "future_monthly_offer" },
		"Paid",
		"Unknown",
	],
	[
		"store/product mismatch",
		{ subscriptionStore: "play_store" },
		"Paid",
		"Unknown",
	],
	[
		"cancelled renewal with paid time left",
		{ subscriptionWillRenew: false },
		"Paid",
		"Monthly",
	],
	[
		"verified store trial",
		{ subscriptionPeriodType: "trial" },
		"Trial",
		"Monthly",
	],
	[
		"paid introductory period",
		{ subscriptionPeriodType: "intro" },
		"Paid",
		"Monthly",
	],
	[
		"missing legacy period",
		{ subscriptionPeriodType: undefined },
		"Unknown",
		"Monthly",
	],
	[
		"unknown provider period",
		{ subscriptionPeriodType: "future_period" },
		"Unknown",
		"Monthly",
	],
	[
		"billing issue without grace",
		{ subscriptionBillingIssueDetectedAt: now - 1000 },
		"Overdue",
		"Monthly",
	],
	[
		"billing grace",
		{
			subscriptionBillingIssueDetectedAt: now - 1000,
			subscriptionExpiresAt: now - 1,
			subscriptionGraceExpiresAt: tomorrow,
		},
		"Overdue",
		"Monthly",
	],
	["expired paid access", { subscriptionExpiresAt: now }, "Expired", "None"],
	[
		"revoked subscription",
		{ revenueCatEntitlementActive: false },
		"Expired",
		"None",
	],
	[
		"revocation falls back to valid app trial",
		{ revenueCatEntitlementActive: false, ...trial },
		"Trial",
		"None",
	],
	[
		"expired app trial",
		{ revenueCatEntitlementActive: false, ...trial, trialExpiresAt: now },
		"Expired",
		"None",
	],
])("projects payment and plan for %s", async (_label, fields, paymentStatus, subscriptionPlan) => {
	const t = convexTest(schema, modules);
	await t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			clerkId: identity.subject,
			tokenIdentifier: identity.tokenIdentifier,
			email: identity.email,
		});
		await ctx.db.insert("accessEntitlements", {
			userId,
			ownerTokenIdentifier: identity.tokenIdentifier,
			revenueCatEntitlementActive: true,
			subscriptionVerifiedAt: now,
			subscriptionExpiresAt: tomorrow,
			subscriptionProductId: monthly,
			subscriptionStore: "app_store",
			subscriptionPeriodType: "normal",
			subscriptionWillRenew: true,
			createdAt: now,
			updatedAt: now,
			...fields,
		});
	});
	expect(
		await t.query(internal.crmSyncState.inspectStudent, {
			pageId,
			clerkId: identity.subject,
			now,
		}),
	).toMatchObject({
		status: "matched",
		projection: { paymentStatus, subscriptionPlan },
	});
});

test("trial and verified purchase changes schedule CRM updates; identical snapshots do not", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	vi.stubEnv("NOTION_CRM_MODE", "off");
	const t = convexTest(schema, modules);
	const auth = t.withIdentity(identity);
	await auth.mutation(api.users.syncCurrentUser, {});
	vi.stubEnv("NOTION_CRM_MODE", "live");
	const scheduledCrm = () =>
		t.run(async (ctx) =>
			(await ctx.db.system.query("_scheduled_functions").take(20)).filter(
				(task) => task.name.includes("crmSync:reconcile"),
			),
		);
	await auth.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "test",
	});
	await auth.mutation(api.entitlements.activateMyTrial, {
		termsVersion: "test",
	});
	expect(await scheduledCrm()).toHaveLength(1);
	const snapshot = {
		ownerTokenIdentifier: identity.tokenIdentifier,
		active: true,
		expiresAt: tomorrow,
		productId: monthly,
		store: "app_store",
		periodType: "normal",
		willRenew: true,
		verifiedAt: now,
	};
	await t.mutation(internal.entitlements.applyRevenueCatSnapshot, snapshot);
	await t.mutation(internal.entitlements.applyRevenueCatSnapshot, {
		...snapshot,
		verifiedAt: now + 1,
	});
	expect(await scheduledCrm()).toHaveLength(2);
	await t.mutation(internal.entitlements.applyRevenueCatSnapshot, {
		...snapshot,
		productId: annual,
	});
	await t.mutation(internal.entitlements.applyRevenueCatSnapshot, {
		...snapshot,
		productId: annual,
		willRenew: false,
	});
	expect(await scheduledCrm()).toHaveLength(4);
	vi.stubEnv("NOTION_CRM_MODE", "off");
	await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test.each([
	"off",
	"dry-run",
])("%s mode does not schedule CRM writes on trial or purchase", async (mode) => {
	vi.useFakeTimers();
	vi.stubEnv("NOTION_CRM_MODE", mode);
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, { termsVersion: "test" });
	await t.mutation(internal.entitlements.applyRevenueCatSnapshot, {
		ownerTokenIdentifier: identity.tokenIdentifier,
		active: true,
		verifiedAt: now,
	});
	expect(
		await t.run(async (ctx) =>
			(await ctx.db.system.query("_scheduled_functions").take(10)).filter(
				(task) => task.name.includes("crmSync:reconcile"),
			),
		),
	).toHaveLength(0);
	await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test("RevenueCat store trial becomes Paid after a verified normal period, without changing app access", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	vi.stubEnv("NOTION_CRM_MODE", "off");
	vi.stubEnv("REVENUECAT_SECRET_API_KEY", "test-only");
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	let period = "trial";
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json({
				subscriber: {
					entitlements: {
						dayova_full_access: {
							product_identifier: monthly,
							expires_date: new Date(tomorrow).toISOString(),
						},
					},
					subscriptions: {
						[monthly]: {
							store: "app_store",
							period_type: period,
							unsubscribe_detected_at: null,
						},
					},
				},
			}),
		),
	);
	for (const [value, expected] of [
		["trial", "Trial"],
		["normal", "Paid"],
	]) {
		period = value;
		await t.action(api.revenueCat.syncMyEntitlement, {});
		expect(
			await t.query(internal.crmSyncState.inspectStudent, {
				pageId,
				clerkId: identity.subject,
				now,
			}),
		).toMatchObject({
			status: "matched",
			projection: {
				state: "paid",
				paymentStatus: expected,
				subscriptionPlan: "Monthly",
			},
		});
	}
});
