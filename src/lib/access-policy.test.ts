import { describe, expect, it } from "vitest";
import {
	getOfflineAccess,
	OFFLINE_ACCESS_WINDOW_MS,
	resolveAccessRoute,
} from "./access-policy";

describe("resolveAccessRoute", () => {
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

	it("never preselects a payer route from the paywall", () => {
		expect(
			resolveAccessRoute({
				accessState: "expired",
				isSessionLoading: false,
				pathname: "/paywall",
				user: { id: "user_1" },
			}),
		).toBeNull();
	});

	it("moves active accounts away from trial and paywall screens", () => {
		expect(
			resolveAccessRoute({
				accessState: "paid",
				isSessionLoading: false,
				pathname: "/paywall",
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
});
