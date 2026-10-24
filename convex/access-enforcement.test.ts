/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = {
	subject: "clerk_access_clock",
	tokenIdentifier: "https://clerk.example|clerk_access_clock",
	name: "Access Clock QA",
	email: "access-clock@example.invalid",
};
const termsVersion = "2026-10-16-30d-v1";

afterEach(() => vi.useRealTimers());

test.each([
	{
		name: "a rewound client clock cannot reopen an expired trial",
		serverNow: "2026-11-21T12:00:00.000Z",
		clientNow: "2026-11-19T12:00:00.000Z",
		state: "expired",
		canUseApp: false,
	},
	{
		name: "a future client clock cannot expire a valid trial early",
		serverNow: "2026-11-19T12:00:00.000Z",
		clientNow: "2100-01-01T00:00:00.000Z",
		state: "trial",
		canUseApp: true,
	},
])("$name", async ({ serverNow, clientNow, state, canUseApp }) => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, { termsVersion });

	vi.setSystemTime(new Date(serverNow));
	// Authentication/profile sync is the existing cold-login server boundary.
	await t.mutation(api.users.syncCurrentUser, {});
	await expect(
		t.query(api.entitlements.getMyAccess, { now: Date.parse(clientNow) }),
	).resolves.toMatchObject({
		state,
		canUseApp,
		trialStartedAt: Date.parse("2026-10-21T12:00:00.000Z"),
		trialExpiresAt: Date.parse("2026-11-20T12:00:00.000Z"),
	});
});

test("learning writes reject server-expired access even without another profile sync", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, { termsVersion });
	const exam = {
		dayKey: "2026-11-23",
		title: "Mathe Klausur",
		time: "09:00",
		kind: "Leistungskontrolle" as const,
		plannedDateLabel: "23. November 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	};
	await expect(t.mutation(api.dayEntries.create, exam)).resolves.toBeTruthy();

	vi.setSystemTime(new Date("2026-11-21T12:00:00.000Z"));
	await expect(
		t.mutation(api.dayEntries.create, { ...exam, title: "After expiry" }),
	).rejects.toMatchObject({
		data: { kind: "userFacing", code: "learningAccessRequired" },
	});
});
// Observable contracts through the real Convex API: scheduler expiry, extension safety,
// fresh action admission, and recovery. No native/service behavior is mocked here.
test("the scheduled boundary expires reactive access without trusting query hints", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, { termsVersion });
	await expect(
		t.query(api.entitlements.getMyAccess, { now: 0 }),
	).resolves.toMatchObject({ state: "trial", canUseApp: true });
	// convex-test uses JS timers, whose maximum delay is below 30 days.
	// Move server time to the real boundary before draining the scheduled callbacks.
	vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	await expect(
		t.query(api.entitlements.getMyAccess, { now: 0 }),
	).resolves.toMatchObject({ state: "expired", canUseApp: false });
});
test("an obsolete expiry job preserves a later manual extension and schedules its real boundary", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, { termsVersion });
	const originalExpiry = Date.parse("2026-11-20T12:00:00Z");
	const extendedExpiry = Date.parse("2026-12-20T12:00:00Z");
	await t.run(async (ctx) => {
		const row = await ctx.db.query("accessEntitlements").unique();
		if (!row) throw new Error("Missing activated fixture");
		await ctx.db.patch("accessEntitlements", row._id, {
			trialExpiresAt: extendedExpiry,
		});
	});
	vi.setSystemTime(new Date(originalExpiry));
	await t.mutation(internal.accessState.evaluateBoundary, {
		ownerTokenIdentifier: identity.tokenIdentifier,
		expectedCheckAt: originalExpiry,
	});
	await expect(
		t.query(api.entitlements.getMyAccess, { now: 0 }),
	).resolves.toMatchObject({ state: "trial", trialExpiresAt: extendedExpiry });
	vi.setSystemTime(new Date(extendedExpiry));
	await t.mutation(internal.accessState.evaluateBoundary, {
		ownerTokenIdentifier: identity.tokenIdentifier,
		expectedCheckAt: extendedExpiry,
	});
	await expect(
		t.query(api.entitlements.getMyAccess, { now: 0 }),
	).resolves.toMatchObject({
		state: "expired",
		trialExpiresAt: extendedExpiry,
	});
});
test("paid grace ends on its server boundary and a stale trial job cannot revoke a renewal", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, { termsVersion });
	const expiresAt = Date.parse("2026-12-01T12:00:00Z");
	const graceExpiresAt = Date.parse("2026-12-03T12:00:00Z");
	await t.mutation(internal.entitlements.applyRevenueCatSnapshot, {
		ownerTokenIdentifier: identity.tokenIdentifier,
		active: true,
		expiresAt,
		graceExpiresAt,
		billingIssueDetectedAt: expiresAt - 1000,
		verifiedAt: Date.now(),
	});
	vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
	await t.mutation(internal.accessState.evaluateBoundary, {
		ownerTokenIdentifier: identity.tokenIdentifier,
		expectedCheckAt: Date.now(),
	});
	await expect(
		t.mutation(api.accessState.refreshMyAccess, {}),
	).resolves.toMatchObject({
		access: { state: "billingGrace", canUseApp: true },
		serverNow: Date.parse("2026-11-20T12:00:00Z"),
	});
	vi.setSystemTime(new Date(graceExpiresAt));
	await t.mutation(internal.accessState.evaluateBoundary, {
		ownerTokenIdentifier: identity.tokenIdentifier,
		expectedCheckAt: graceExpiresAt,
	});
	await expect(
		t.query(api.entitlements.getMyAccess, { now: 0 }),
	).resolves.toMatchObject({ state: "expired", canUseApp: false });
});
test("expired accounts cannot read protected learning data but can recover their account", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await t.mutation(api.entitlements.activateMyTrial, { termsVersion });
	vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
	await t.mutation(api.accessState.refreshMyAccess, {});
	await expect(
		t.query(api.learningPlans.listOverview, {}),
	).rejects.toMatchObject({ data: { kind: "userFacing" } });
	await expect(t.query(api.users.getMe, {})).resolves.toMatchObject({
		email: "access-clock@example.invalid",
	});
});

// Fresh learners may manage their account without consenting to a trial.
test("unactivated learning reads expose a distinct eligibility denial and retain recovery", async () => {
	const t = convexTest(schema, modules).withIdentity(identity);
	await t.mutation(api.users.syncCurrentUser, {});
	await expect(
		t.mutation(api.accessState.refreshMyAccess, {}),
	).resolves.toMatchObject({
		access: { state: "needsActivation", canUseApp: false },
	});
	await expect(
		t.query(api.dayEntries.listByDayKeys, {
			dayKeys: ["2026-10-24"],
			cacheScope: "notificationPlanning",
		}),
	).rejects.toMatchObject({
		data: { kind: "userFacing", code: "learningAccessRequired" },
	});
	await expect(t.query(api.users.getMe, {})).resolves.toMatchObject({
		email: "access-clock@example.invalid",
	});
});
