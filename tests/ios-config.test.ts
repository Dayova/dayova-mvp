import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const IOS_INFO_PLIST_PATH = resolve(process.cwd(), "ios/Dayova/Info.plist");
const IOS_ENTITLEMENTS_PATH = resolve(
	process.cwd(),
	"ios/Dayova/Dayova.entitlements",
);
const APPLE_SIGN_IN_ENTITLEMENT = "com.apple.developer.applesignin";

type IosConfig = {
	bundleIdentifier?: string;
	usesAppleSignIn?: boolean;
	infoPlist?: Record<string, unknown>;
	entitlements?: Record<string, unknown>;
};

const configs: Partial<Record<"development" | "production", IosConfig>> = {};

describe("final Expo iOS configuration", () => {
	// Real CLI integration checks: resolve each variant once in setup, with a
	// bounded child process that does not block Vitest's own timeout handling.
	beforeAll(async () => {
		for (const variant of ["development", "production"] as const) {
			const { stdout } = await execFileAsync(
				process.execPath,
				[
					require.resolve("expo/bin/cli"),
					"config",
					"--type",
					"introspect",
					"--json",
				],
				{
					cwd: process.cwd(),
					encoding: "utf8",
					timeout: 25_000,
					windowsHide: true,
					env: {
						...process.env,
						APP_VARIANT: variant,
						JITI_REBUILD_FS_CACHE: "true",
					},
				},
			);
			configs[variant] = JSON.parse(stdout).ios ?? {};
		}
	}, 60_000);

	it("keeps required privacy keys in the final Expo config and any generated native plist", () => {
		const infoPlist = configs.production?.infoPlist ?? {};
		const nativePlist = existsSync(IOS_INFO_PLIST_PATH)
			? readFileSync(IOS_INFO_PLIST_PATH, "utf8")
			: null;
		for (const key of [
			"NSCameraUsageDescription",
			"NSPhotoLibraryUsageDescription",
		]) {
			expect(infoPlist[key], `${key} missing from final Expo iOS config`).toEqual(
				expect.any(String),
			);
			if (nativePlist !== null) {
				const match = nativePlist.match(
					new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`),
				);
				expect(
					match?.[1] ?? null,
					`${key} missing from ios/Dayova/Info.plist`,
				).toEqual(infoPlist[key]);
			}
		}
		for (const key of [
			"NSMicrophoneUsageDescription",
			"NSSpeechRecognitionUsageDescription",
		]) {
			expect(infoPlist[key], `${key} should not be requested`).toBeUndefined();
		}
	});

	it("does not request Sign in with Apple for password-only authentication", () => {
		expect(
			configs.production?.entitlements?.[APPLE_SIGN_IN_ENTITLEMENT],
		).toBeUndefined();
		if (existsSync(IOS_ENTITLEMENTS_PATH)) {
			expect(readFileSync(IOS_ENTITLEMENTS_PATH, "utf8")).not.toContain(
				APPLE_SIGN_IN_ENTITLEMENT,
			);
		}
	});

	it.each([
		["development", "de.dayova.app-dev"],
		["production", "de.dayova.app"],
	] as const)(
		"keeps Apple sign-in absent from the %s Expo config",
		(variant, bundleIdentifier) => {
			expect(configs[variant]?.bundleIdentifier).toBe(bundleIdentifier);
			expect(configs[variant]?.usesAppleSignIn).toBeUndefined();
			expect(configs[variant]?.entitlements ?? {}).not.toHaveProperty(
				APPLE_SIGN_IN_ENTITLEMENT,
			);
		},
	);

	it("keeps Apple sign-in absent from generated native entitlements when present", () => {
		if (existsSync(IOS_ENTITLEMENTS_PATH)) {
			expect(readFileSync(IOS_ENTITLEMENTS_PATH, "utf8")).not.toContain(
				APPLE_SIGN_IN_ENTITLEMENT,
			);
		}
	});
});
