// @vitest-environment node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

it.each([
	["development", "de.dayova.app-dev"],
	["production", "de.dayova.app"],
] as const)(
	"resolves the %s iOS identity and password-only privacy contract",
	(variant, bundleIdentifier) => {
		const config = JSON.parse(
			execFileSync(
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
					env: { ...process.env, APP_VARIANT: variant },
				},
			),
		);
		expect(config.ios.bundleIdentifier).toBe(bundleIdentifier);
		expect(config.ios.usesAppleSignIn).toBeUndefined();
		expect(config.ios.entitlements ?? {}).not.toHaveProperty(
			"com.apple.developer.applesignin",
		);
		for (const key of [
			"NSCameraUsageDescription",
			"NSPhotoLibraryUsageDescription",
		]) {
			expect(config.ios.infoPlist[key]).toMatch(/\S/);
		}
		expect(config.ios.infoPlist).not.toHaveProperty(
			"NSMicrophoneUsageDescription",
		);
		expect(config.ios.infoPlist).not.toHaveProperty(
			"NSSpeechRecognitionUsageDescription",
		);
		expect(config.userInterfaceStyle).toBe("automatic");
	},
	20_000,
);
