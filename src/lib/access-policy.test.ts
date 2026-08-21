import { describe, expect, it } from "vitest";
import {
	getOfflineAccess,
	getNextAccessRefreshAt,
	OFFLINE_ACCESS_WINDOW_MS,
	resolveAccessRoute,
} from "./access-policy";
import {
	PASSWORD_RESET_SUCCESS_PATH,
	SESSION_TASK_RESET_PASSWORD_PATH,
} from "./auth-routing";

describe("resolveAccessRoute", () => {
	it("returns unauthenticated users to the public entry route", () => {
		expect(
			resolveAccessRoute({
				accessState: undefined,
				isSessionLoading: false,
				pathname: "/home",
				user: null,
			}),
		).toBe("/");
	});

	it("sends an authenticated account without access to trial activation", () => {
		expect(
			resolveAccessRoute({
				accessState: "needsActivation",
				isSessionLoading: false,
				pathname: "/home",
				user: { id: "user_1" },
			}),
		).toBe("/trial");
	});

	it("does not interrupt registration onboarding before trial activation", () => {
		expect(
			resolveAccessRoute({
				accessState: "needsActivation",
				isSessionLoading: false,
				pathname: "/onboarding",
				user: { id: "user_1" },
			}),
		).toBeNull();
		expect(
			resolveAccessRoute({
				accessState: "needsActivation",
				isSessionLoading: false,
				pathname: "/onboarding/verification",
				user: { id: "user_1" },
			}),
		).toBeNull();
	});

	it.each([
		PASSWORD_RESET_SUCCESS_PATH,
		SESSION_TASK_RESET_PASSWORD_PATH,
	])("does not interrupt the auth recovery route %s", (pathname) => {
		expect(
			resolveAccessRoute({
				accessState: "needsActivation",
				isSessionLoading: false,
				pathname,
				user: { id: "user_1" },
			}),
		).toBeNull();
	});

	it("hard-locks expired accounts on the paywall", () => {
		expect(
			resolveAccessRoute({
				accessState: "expired",
				isSessionLoading: false,
				pathname: "/learning-plans",
				user: { id: "user_1" },
			}),
		).toBe("/paywall");
	});

	it.each([
		"/paywall",
		"/subscription",
	])("keeps expired accounts inside the payment flow on %s", (pathname) => {
		expect(
			resolveAccessRoute({
				accessState: "expired",
				isSessionLoading: false,
				pathname,
				user: { id: "user_1" },
			}),
		).toBeNull();
	});

	it.each([
		"/trial",
		"/paywall",
		"/subscription",
	])("moves active accounts away from access setup on %s", (pathname) => {
		expect(
			resolveAccessRoute({
				accessState: "paid",
				isSessionLoading: false,
				pathname,
				user: { id: "user_1" },
			}),
		).toBe("/home");
	});

	it("keeps a newly paid account on the Pro welcome route", () => {
		expect(
			resolveAccessRoute({
				accessState: "paid",
				isSessionLoading: false,
				pathname: "/pro-welcome",
				user: { id: "user_1" },
			}),
		).toBeNull();
	});

	it("does not show the Pro welcome route to trial accounts", () => {
		expect(
			resolveAccessRoute({
				accessState: "trial",
				isSessionLoading: false,
				pathname: "/pro-welcome",
				user: { id: "user_1" },
			}),
		).toBe("/home");
	});
});

describe("getOfflineAccess", () => {
	const verifiedAt = Date.parse("2026-07-28T10:00:00.000Z");

	it("allows a previously verified paid account for at most 72 hours", () => {
		expect(
			getOfflineAccess({
				access: {
					canUseApp: true,
					state: "paid",
					subscriptionExpiresAt: Date.parse("2026-08-28T10:00:00.000Z"),
				},
				now: verifiedAt + OFFLINE_ACCESS_WINDOW_MS,
				verifiedAt,
			}),
		).toBe(true);

		expect(
			getOfflineAccess({
				access: {
					canUseApp: true,
					state: "paid",
					subscriptionExpiresAt: Date.parse("2026-08-28T10:00:00.000Z"),
				},
				now: verifiedAt + OFFLINE_ACCESS_WINDOW_MS + 1,
				verifiedAt,
			}),
		).toBe(false);
	});

	it("never extends a trial beyond its server-defined expiry", () => {
		const trialExpiresAt = verifiedAt + 24 * 60 * 60 * 1000;

		expect(
			getOfflineAccess({
				access: {
					canUseApp: true,
					state: "trial",
					trialExpiresAt,
				},
				now: trialExpiresAt,
				verifiedAt,
			}),
		).toBe(false);
	});

	it("never grants offline access from an expired snapshot", () => {
		expect(
			getOfflineAccess({
				access: {
					canUseApp: false,
					state: "expired",
					trialExpiresAt: verifiedAt,
				},
				now: verifiedAt,
				verifiedAt,
			}),
		).toBe(false);
	});

	it("uses the later paid or grace expiry for offline access", () => {
		expect(
			getOfflineAccess({
				access: {
					canUseApp: true,
					state: "billingGrace",
					subscriptionExpiresAt: verifiedAt + 48 * 60 * 60 * 1000,
					subscriptionGraceExpiresAt: verifiedAt + 24 * 60 * 60 * 1000,
				},
				now: verifiedAt + 36 * 60 * 60 * 1000,
				verifiedAt,
			}),
		).toBe(true);
	});
});

describe("getNextAccessRefreshAt", () => {
	it("returns only the entitlement cutoff that can change access", () => {
		const trialExpiresAt = Date.parse("2026-08-11T10:00:00.000Z");
		expect(
			getNextAccessRefreshAt({
				canUseApp: true,
				state: "trial",
				trialExpiresAt,
			}),
		).toBe(trialExpiresAt);

		expect(
			getNextAccessRefreshAt({
				canUseApp: true,
				state: "billingGrace",
				subscriptionExpiresAt: trialExpiresAt + 1,
				subscriptionGraceExpiresAt: trialExpiresAt,
			}),
		).toBe(trialExpiresAt + 1);
		expect(
			getNextAccessRefreshAt({
				canUseApp: false,
				state: "expired",
			}),
		).toBeNull();
	});
});
