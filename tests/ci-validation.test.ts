// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scopeScript = resolve("scripts/ci-native-changes.mjs");
const testEnv: NodeJS.ProcessEnv = {
	...process.env,
	APP_VARIANT: "preview",
	DAYOVA_CI_VALIDATION: "true",
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
	EXPO_PUBLIC_CONVEX_URL: "https://resilient-pika-316.eu-west-1.convex.cloud",
	EXPO_PUBLIC_POSTHOG_API_KEY: "",
	EAS_BUILD: "false",
	NODE_ENV: "development",
};

describe("isolated native CI configuration", () => {
	it.each([
		{},
		{ APP_VARIANT: "production" },
		{ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture" },
		{ EXPO_PUBLIC_CONVEX_URL: "https://other.convex.cloud" },
		{ EXPO_PUBLIC_POSTHOG_API_KEY: "tracking-enabled" },
	])("resolves only a test app with pinned embedded JavaScript (%j)", (override) => {
		const result = spawnSync(
			process.execPath,
			["-e", "console.log(JSON.stringify(require('./app.config.cts')))"],
			{ encoding: "utf8", env: { ...testEnv, ...override } },
		);
		if (Object.keys(override).length > 0) {
			expect(result.status).not.toBe(0);
			expect(result.stderr).toContain("CI validation requires");
		} else {
			expect(result.status, result.stderr).toBe(0);
			const config = JSON.parse(result.stdout);
			expect(config.ios.bundleIdentifier).toBe("de.dayova.app-dev");
			expect(config.android.package).toBe("com.dayova.dev");
			expect(config.updates.enabled).toBe(false);
		}
	});
});

describe("native validation scope over real Git history", () => {
	it.each([
		["docs/example.md", false],
		["src/features/dashboard/example.tsx", false],
		["app.config.cts", true],
		["pnpm-lock.yaml", true],
		["modules/example/index.ts", true],
		["src/context/Example.tsx", true],
		[".maestro/flows/example.yaml", true],
	])("routes a change to %s", (path, expected) => {
		const directory = mkdtempSync(join(tmpdir(), "dayova-ci-scope-"));
		const git = (...args: string[]) =>
			execFileSync("git", args, {
				cwd: directory,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}).trim();
		try {
			git("init", "-b", "main");
			git("config", "user.name", "CI fixture");
			git("config", "user.email", "ci@example.invalid");
			writeFileSync(join(directory, "README.md"), "base");
			git("add", ".");
			git("commit", "-m", "base");
			const base = git("rev-parse", "HEAD");
			git("remote", "add", "origin", directory);
			mkdirSync(dirname(join(directory, path)), { recursive: true });
			writeFileSync(join(directory, path), "candidate");
			git("add", ".");
			git("commit", "-m", "candidate");
			const result = spawnSync(process.execPath, [scopeScript], {
				cwd: directory,
				encoding: "utf8",
				env: {
					...process.env,
					CI_EVENT_NAME: "pull_request",
					CI_BASE_SHA: base,
					CI_NATIVE_FORCE: "false",
				},
			});
			expect(result.status, result.stderr).toBe(0);
			const decision = JSON.parse(result.stdout);
			expect(decision.required).toBe(expected);
			expect(decision.paths).toEqual(expected ? [path] : []);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
	it("fails instead of skipping native checks when comparison provenance is missing", () => {
		const result = spawnSync(process.execPath, [scopeScript], {
			encoding: "utf8",
			env: {
				...process.env,
				CI_EVENT_NAME: "pull_request",
				CI_BASE_SHA: "",
				CI_NATIVE_FORCE: "false",
				CI_REF_NAME: "feature",
			},
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("verified comparison commit");
	});
});
