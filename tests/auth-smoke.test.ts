// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authenticatedSmoke } from "../scripts/auth-smoke.mjs";

const env = {
	NODE_ENV: "test" as const,
	APP_VARIANT: "preview",
	CI_CONVEX_PREVIEW_NAME: "ci-aaaaaaaaaaaa-123456abcdef",
	CI_CONVEX_SOURCE_SHA: "a".repeat(40),
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
		"pk_test_" +
		Buffer.from("warm-parrot-13.clerk.accounts.dev$").toString("base64"),
	EXPO_PUBLIC_CONVEX_URL: "https://gentle-preview-123.eu-west-1.convex.cloud",
	MAESTRO_CI_EMAIL: "ci+clerk_test@example.com",
	MAESTRO_CI_PASSWORD: "fixture-password",
};
function services(fault = "") {
	let initialized = false,
		onboarding = false,
		removed = false;
	const request = vi.fn<typeof fetch>(async (input, init) => {
		if (typeof input !== "string" || !init)
			throw Error("Missing HTTP boundary arguments");
		if (input.includes("/api/")) {
			const { path } = JSON.parse(String(init.body));
			if (!(init.headers as Record<string, string>).Authorization)
				return Response.json({
					status: fault === "anonymous-access" ? "success" : "error",
				});
			if (path === "users:syncCurrentUser") {
				if (fault === "sync-failure") return Response.json({ status: "error" });
				initialized = true;
				return Response.json({ status: "success", value: "synthetic-user" });
			}
			if (path === "users:saveOnboardingAnswers") {
				onboarding = true;
				return Response.json({
					status: fault === "onboarding-failure" ? "error" : "success",
					value: { success: true },
				});
			}
			if (path === "users:getMe") {
				if (!initialized) throw Error("Fresh preview has no synchronized user");
				if (fault === "backend-and-cleanup-failure")
					return Response.json({}, { status: 503 });
				return Response.json({
					status: "success",
					value: {
						_id: "synthetic-user",
						email:
							fault === "wrong-user"
								? "other@example.com"
								: env.MAESTRO_CI_EMAIL,
					},
				});
			}
			if (path === "entitlements:getMyAccess")
				return Response.json(
					fault === "missing-access-api"
						? {
								status: "error",
								errorMessage: "Could not find public function",
							}
						: {
								status: "success",
								value: { state: "needsActivation", canUseApp: false },
							},
				);
			if (path === "dayEntries:listByDayKeys") {
				const { args } = JSON.parse(String(init.body));
				if (fault === "access-denied")
					return Response.json({
						status: "error",
						errorData: { kind: "userFacing", message: "No app eligibility" },
					});
				if (fault === "stale-notification-validator")
					return Response.json({
						status: "error",
						errorMessage: "ArgumentValidationError: extra cacheScope",
					});
				return Response.json({
					status: "success",
					value:
						fault === "malformed-notification-result"
							? {}
							: { [args.dayKeys[0]]: [] },
				});
			}
			if (path === "notifications:getPreferences")
				return Response.json({
					status: fault === "missing-notification-api" ? "error" : "success",
					value: {},
				});
			throw Error("Unexpected Convex API");
		}
		if (input.includes("/sign_ins?"))
			return Response.json({
				response: { status: "complete", created_session_id: "test-session" },
			});
		if (input.includes("/tokens/convex?"))
			return Response.json({ response: { jwt: "fixture-jwt" } });
		if (input.includes("/remove?")) {
			removed = true;
			return Response.json(
				{},
				{ status: fault.endsWith("cleanup-failure") ? 503 : 200 },
			);
		}
		throw Error("Unexpected external URL");
	});
	return { request, state: () => ({ initialized, onboarding, removed }) };
}
describe("real-service authentication probe consumer", () => {
	it("initializes a fresh synthetic learner without granting access and closes its Clerk session", async () => {
		const boundary = services();
		await expect(authenticatedSmoke(env, boundary.request)).resolves.toEqual({
			clerkSignIn: "success",
			authenticatedConvexQuery: "success",
			unauthenticatedConvexQuery: "denied",
			notificationBootstrapQuery: "success",
			notificationPlanningQuery: "success",
			accessBootstrapQuery: "success",
			syntheticUserInitialization: "success",
		});
		expect(boundary.state()).toEqual({
			initialized: true,
			onboarding: true,
			removed: true,
		});
		const mutations = boundary.request.mock.calls
			.filter(([url]) => String(url).endsWith("/api/mutation"))
			.map(([, init]) => JSON.parse(String(init?.body)).path);
		expect(new Set(mutations)).toEqual(
			new Set(["users:syncCurrentUser", "users:saveOnboardingAnswers"]),
		);
	});
	it.each([
		"anonymous-access",
		"wrong-user",
		"sync-failure",
		"onboarding-failure",
		"missing-access-api",
		"missing-notification-api",
		"stale-notification-validator",
		"malformed-notification-result",
		"access-denied",
	])("rejects %s rather than accepting a stale/unusable backend", async (fault) => {
		const boundary = services(fault);
		await expect(authenticatedSmoke(env, boundary.request)).rejects.toThrow();
		if (fault !== "anonymous-access")
			expect(boundary.state().removed).toBe(true);
	});
	it("preserves the backend error when cleanup also fails", async () => {
		const boundary = services("backend-and-cleanup-failure");
		await expect(
			authenticatedSmoke(env, boundary.request),
		).rejects.toMatchObject({
			message: "Convex query failed (HTTP 503)",
			smokeStage: "authenticated-convex-query",
			cleanupFailed: true,
		});
	});
	it.each([
		{ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture" },
		{
			EXPO_PUBLIC_CONVEX_URL:
				"https://resilient-pika-316.eu-west-1.convex.cloud",
		},
		{ CI_CONVEX_PREVIEW_NAME: "" },
	])("rejects unsafe configuration before HTTP (%j)", async (override) => {
		const boundary = services();
		await expect(
			authenticatedSmoke({ ...env, ...override }, boundary.request),
		).rejects.toThrow("CI validation requires");
		expect(boundary.request).not.toHaveBeenCalled();
	});
});
