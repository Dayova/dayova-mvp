// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const environmentFiles = vi.hoisted(() => new Set<string>());

// Only the filesystem precondition and native process boundary are replaced.
// These cases prove unsafe configurations cannot start a device/backend or
// issue network requests; the hosted journey verifies the positive behavior.
vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		existsSync: (path: string) =>
			path === ".env.local" || path === ".env"
				? environmentFiles.has(path)
				: actual.existsSync(path),
	};
});
vi.mock("node:child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:child_process")>();
	return {
		...actual,
		spawn: vi.fn(() => {
			throw new Error("Unexpected native process");
		}),
	};
});

import { spawn } from "node:child_process";
import { runContactPreferencesQa } from "../scripts/native-qa/contact-preferences-qa.mjs";

const env = {
	NODE_ENV: "test" as const,
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from("warm-parrot-13.clerk.accounts.dev$").toString("base64")}`,
	EXPO_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
	MAESTRO_APP_ID: "de.dayova.app-dev",
	MAESTRO_CI_EMAIL: "native+clerk_test@example.com",
	MAESTRO_CI_PASSWORD: "test-only-placeholder",
};
beforeEach(() => {
	vi.clearAllMocks();
	environmentFiles.clear();
});
describe("isolated contact acceptance runner", () => {
	it.each([
		{ MAESTRO_APP_ID: "de.dayova.app" },
		{ EXPO_PUBLIC_CONVEX_URL: "https://production.example.com" },
		{ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example" },
		{ MAESTRO_CI_EMAIL: "real-person@example.com" },
		{ CONVEX_DEPLOY_KEY: "production-secret-placeholder" },
		{ CONVEX_DEPLOYMENT: "prod:remote-deployment" },
		{ CONVEX_DEPLOYMENT_TOKEN: "production-token-placeholder" },
		{ CONVEX_SELF_HOSTED_URL: "https://production.example.com" },
		{ CONVEX_SELF_HOSTED_ADMIN_KEY: "production-admin-placeholder" },
		{ CONVEX_OVERRIDE_ACCESS_TOKEN: "production-access-placeholder" },
	])("rejects unsafe configuration before native work: %j", async (unsafe) => {
		await expect(
			runContactPreferencesQa("development.app", {
				env: { ...env, ...unsafe },
			}),
		).rejects.toThrow("isolated test app/Clerk identity and loopback backend");
		expect(spawn).not.toHaveBeenCalled();
	});
	it.each([
		".env",
		".env.local",
	])("rejects implicit settings from %s", async (path) => {
		environmentFiles.add(path);
		await expect(
			runContactPreferencesQa("development.app", { env }),
		).rejects.toThrow("fresh checkout");
		expect(spawn).not.toHaveBeenCalled();
	});
});
