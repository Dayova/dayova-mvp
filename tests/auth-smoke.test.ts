// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authenticatedSmoke } from "../scripts/auth-smoke.mjs";

const env = {
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(
		"warm-parrot-13.clerk.accounts.dev$",
	).toString("base64")}`,
	EXPO_PUBLIC_CONVEX_URL: "https://resilient-pika-316.eu-west-1.convex.cloud",
	MAESTRO_CI_EMAIL: "ci+clerk_test@example.com",
	MAESTRO_CI_PASSWORD: "fixture-password",
};

function serviceResponses(condition = "valid") {
	const requests: { url: string; init: RequestInit }[] = [];
	const request = vi.fn(async (url: string, init: RequestInit) => {
		requests.push({ url, init });
		if (url.endsWith("/api/query")) {
			if (!(init.headers as Record<string, string>).Authorization)
				return Response.json({
					status: condition === "anonymous-access" ? "success" : "error",
				});
			if (condition === "backend-and-cleanup-failure")
				return Response.json({}, { status: 503 });
			return Response.json({
				status: "success",
				value: {
					_id: "synthetic-user",
					email:
						condition === "wrong-user"
							? "other+clerk_test@example.com"
							: env.MAESTRO_CI_EMAIL,
				},
			});
		}
		if (url.includes("/sign_ins?"))
			return Response.json({
				response: { status: "complete", created_session_id: "test-session" },
			});
		if (url.includes("/tokens/convex?"))
			return Response.json({ response: { jwt: "fixture-jwt" } });
		if (url.includes("/remove?")) {
			if (condition.endsWith("cleanup-failure"))
				return Response.json({}, { status: 503 });
			return Response.json({});
		}
		throw new Error(`Unexpected external request: ${url}`);
	});
	return { request, requests };
}

describe("real-service authentication probe consumer", () => {
	it("passes only a matching authenticated user and removes its Clerk session", async () => {
		const { request, requests } = serviceResponses();
		await expect(authenticatedSmoke(env, request)).resolves.toEqual({
			clerkSignIn: "success",
			authenticatedConvexQuery: "success",
			unauthenticatedConvexQuery: "denied",
		});
		expect(
			requests.filter((value) => value.url.includes("/remove?")),
		).toHaveLength(1);
		const authenticatedQuery = requests.find(
			(value) =>
				value.url.endsWith("/api/query") &&
				(value.init.headers as Record<string, string>).Authorization,
		);
		expect(authenticatedQuery?.init.headers).toMatchObject({
			Authorization: "Bearer fixture-jwt",
		});
	});
	it.each([
		"anonymous-access",
		"wrong-user",
	])("rejects an invalid %s service response", async (condition) => {
		const { request, requests } = serviceResponses(condition);
		await expect(authenticatedSmoke(env, request)).rejects.toThrow(
			condition === "anonymous-access"
				? "Unauthenticated Convex access was not denied"
				: "authenticated synthetic user",
		);
		if (condition === "wrong-user")
			expect(
				requests.filter((value) => value.url.includes("/remove?")),
			).toHaveLength(1);
	});
	it("retains the original backend failure when session cleanup also fails", async () => {
		const { request } = serviceResponses("backend-and-cleanup-failure");
		await expect(authenticatedSmoke(env, request)).rejects.toMatchObject({
			message: "Convex query failed (HTTP 503)",
			smokeStage: "authenticated-convex-query",
			cleanupFailed: true,
		});
	});
	it("rejects production configuration before contacting any service", async () => {
		const { request } = serviceResponses();
		await expect(
			authenticatedSmoke(
				{ ...env, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture" },
				request,
			),
		).rejects.toThrow("isolated development tenant");
		expect(request).not.toHaveBeenCalled();
	});
});
