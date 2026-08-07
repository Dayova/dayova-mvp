import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IOS_ENTITLEMENTS_PATH = resolve(
	process.cwd(),
	"ios/Dayova/Dayova.entitlements",
);

const readFinalExpoIosConfig = (variant: "development" | "production") => {
	const output = execFileSync(
		"npx",
		["expo", "config", "--type", "introspect", "--json"],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				APP_VARIANT: variant,
				JITI_REBUILD_FS_CACHE: "true",
			},
		},
	);

	return JSON.parse(output).ios ?? {};
};

describe("iOS Apple sign-in capability", () => {
	it.each([
		["development", "de.dayova.app-dev"],
		["production", "de.dayova.app"],
	] as const)(
		"keeps Apple sign-in absent from the %s Expo config",
		(variant, bundleIdentifier) => {
			const iosConfig = readFinalExpoIosConfig(variant);

			expect(iosConfig.bundleIdentifier).toBe(bundleIdentifier);
			expect(iosConfig.usesAppleSignIn).toBeUndefined();
			expect(iosConfig.entitlements ?? {}).not.toHaveProperty(
				"com.apple.developer.applesignin",
			);
		},
		20_000,
	);

	it("keeps Apple sign-in absent from generated native entitlements when present", () => {
		if (!existsSync(IOS_ENTITLEMENTS_PATH)) {
			return;
		}

		const nativeEntitlements = readFileSync(IOS_ENTITLEMENTS_PATH, "utf8");

		expect(nativeEntitlements).not.toContain(
			"com.apple.developer.applesignin",
		);
	});
});
