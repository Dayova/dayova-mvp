// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
		spawnSync: vi.fn(() => {
			throw new Error("Unexpected native process");
		}),
	};
});

import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
	writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runContactPreferencesQa } from "../scripts/native-qa/contact-preferences-qa.mjs";

const env = {
	NODE_ENV: "test" as const,
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from("warm-parrot-13.clerk.accounts.dev$").toString("base64")}`,
	EXPO_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
	MAESTRO_APP_ID: "de.dayova.app-dev",
	MAESTRO_CI_EMAIL: "native+clerk_test@example.com",
	MAESTRO_CI_PASSWORD: "test-only-placeholder",
};
const network = vi.fn<typeof fetch>();
beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(spawn)
		.mockReset()
		.mockImplementation(() => {
			throw new Error("Unexpected native process");
		});
	vi.mocked(spawnSync)
		.mockReset()
		.mockImplementation(() => {
			throw new Error("Unexpected native process");
		});
	network
		.mockReset()
		.mockRejectedValue(new Error("Unexpected network request"));
	vi.stubGlobal("fetch", network);
	environmentFiles.clear();
});
afterEach(() => vi.unstubAllGlobals());
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

describe("native registration acceptance", () => {
	it("rejects unknown scenarios before a process or request begins", async () => {
		await expect(
			runContactPreferencesQa("development.app", { env, scenario: "unknown" }),
		).rejects.toThrow("known QA scenario");
		expect(spawn).not.toHaveBeenCalled();
		expect(spawnSync).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});

	it.each([
		{ wrongOwner: false, nativeFailure: false },
		{ wrongOwner: true, nativeFailure: false },
		{ wrongOwner: false, nativeFailure: true },
	])("keeps registration private and cleans up safely: %j", async ({
		wrongOwner,
		nativeFailure,
	}) => {
		const root = mkdtempSync(join(tmpdir(), "dayova-native-registration-"));
		const originalCwd = process.cwd();
		const kill = vi.spyOn(process, "kill").mockReturnValue(true);
		let nativeEmail: string | undefined;
		let nativePassword: string | undefined;
		let registered = false;
		let deleted = false;
		let mutations = 0;
		const response = (value: unknown) =>
			new Response(JSON.stringify({ response: value }), {
				headers: { authorization: "fixture-native-client" },
			});
		// Only native processes and remote HTTP are simulated. The real public
		// runner chooses the identity, sequences registration/verification,
		// sanitizes files and promotes its actual report directory.
		vi.mocked(spawn).mockImplementation((_command, args) => {
			if (args?.includes("convex")) environmentFiles.add(".env.local");
			return { pid: 1_999_999_999 } as ReturnType<typeof spawn>;
		});
		vi.mocked(spawnSync).mockImplementation(((command, args, options) => {
			if (command === "git")
				return {
					status: 0,
					stdout: "1234567890abcdef1234567890abcdef12345678",
				};
			if (command === "maestro" && Array.isArray(args)) {
				if (!args.includes(".maestro/ci/contact-registration.yaml"))
					throw new Error("Wrong native journey");
				nativeEmail = options?.env?.MAESTRO_CI_EMAIL;
				nativePassword = options?.env?.MAESTRO_CI_PASSWORD;
				if (!nativeEmail || !nativePassword)
					throw new Error("Missing native credentials");
				registered = true;
				const directory = String(args[args.indexOf("--test-output-dir") + 1]);
				writeFileSync(
					join(directory, "report.xml"),
					`<testsuite tests="1"><system-out>${nativeEmail} ${nativePassword}</system-out></testsuite>`,
				);
				writeFileSync(
					join(directory, "credential-entry.png"),
					Buffer.from([137, 80, 78, 71, 0]),
				);
				writeFileSync(
					join(directory, "private-native-details.txt"),
					"private fixture",
				);
				if (nativeFailure) return { status: 1 };
			}
			if (command === "xcrun" && args?.includes("log"))
				writeSync(
					(options?.stdio as number[])[1],
					`${nativeEmail} ${nativePassword}`,
				);
			return { status: 0 };
		}) as typeof spawnSync);
		network.mockImplementation(async (input, init) => {
			const url = new URL(String(input));
			if (url.hostname === "127.0.0.1") {
				if (url.pathname === "/version" || url.pathname === "/status")
					return new Response("ready");
				const body = JSON.parse(String(init?.body));
				if (url.pathname === "/api/mutation") {
					mutations++;
					throw new Error("Registration must not seed backend state");
				}
				const value =
					body.path === "learningTimes:listMine"
						? [{ dayOfWeek: 1, startTime: "15:00", endTime: "15:30" }]
						: {
								phone: "",
								feedback: false,
								news: false,
								version: "2026-10-21.contact.v1",
								revision: 1,
							};
				return new Response(JSON.stringify({ status: "success", value }));
			}
			if (url.hostname !== "warm-parrot-13.clerk.accounts.dev")
				throw new Error("Unexpected remote target");
			if (url.pathname === "/v1/client/sign_ins") {
				if (!registered) throw new Error("Registration must be native-first");
				const form = new URLSearchParams(String(init?.body));
				expect(form.get("identifier")).toBe(nativeEmail);
				expect(form.get("password")).toBe(nativePassword);
				return response({
					status: "complete",
					created_session_id: "registration-session",
				});
			}
			if (url.pathname.endsWith("/tokens/convex"))
				return response({ jwt: "fixture-jwt" });
			if (url.pathname === "/v1/me") {
				expect(url.searchParams.get("_clerk_session_id")).toBe(
					"registration-session",
				);
				if (url.searchParams.get("_method") === "DELETE") {
					deleted = true;
					return response({ deleted: true });
				}
				return response({
					primary_email_address_id: "new-email",
					email_addresses: [
						{
							id: "new-email",
							email_address: wrongOwner ? "unrelated@example.com" : nativeEmail,
						},
					],
				});
			}
			throw new Error("Unexpected Clerk operation");
		});
		try {
			process.chdir(root);
			mkdirSync("convex");
			writeFileSync("convex/auth.config.ts", "fixture");
			const run = runContactPreferencesQa("development.app", {
				env,
				scenario: "registration",
			});
			if (wrongOwner)
				await expect(run).rejects.toThrow(
					"Disposable QA account cleanup failed",
				);
			else if (nativeFailure)
				await expect(run).rejects.toThrow(
					"contact-registration native journey failed",
				);
			else await run;
			expect(nativeEmail).toContain("+clerk_test@");
			expect(nativeEmail).not.toBe(env.MAESTRO_CI_EMAIL);
			expect(nativePassword).not.toBe(env.MAESTRO_CI_PASSWORD);
			expect(mutations).toBe(0);
			expect(deleted).toBe(!wrongOwner);
			const directory =
				".maestro/artifacts/contact-qa/public/contact-registration/.maestro/tests";
			expect(readdirSync(directory).sort()).toEqual([
				"redaction.json",
				"report.xml",
				"result.json",
			]);
			const report = readFileSync(join(directory, "report.xml"), "utf8");
			expect(report).toContain("[redacted]");
			expect(report).not.toContain(nativeEmail);
			expect(report).not.toContain(nativePassword);
			expect(
				existsSync(
					".maestro/artifacts/contact-qa/private/contact-registration/.maestro/tests/credential-entry.png",
				),
			).toBe(true);
			const acceptance = JSON.parse(
				readFileSync(
					".maestro/artifacts/contact-qa/public/acceptance.json",
					"utf8",
				),
			);
			expect(acceptance).toMatchObject({
				scenario: "registration",
				completed: !wrongOwner && !nativeFailure,
			});
		} finally {
			process.chdir(originalCwd);
			kill.mockRestore();
			rmSync(root, { recursive: true, force: true });
		}
	});
});
