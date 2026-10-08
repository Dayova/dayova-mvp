import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readExpoConfigSnapshot } from "./helpers/expo-config-contract";

const IOS_ENTITLEMENTS_PATH = resolve(
	process.cwd(),
	"ios/Dayova/Dayova.entitlements",
);
const SIGN_IN_WITH_APPLE_ENTITLEMENT = "com.apple.developer.applesignin";

const readFinalExpoEntitlements = () => {
	return (
		readExpoConfigSnapshot("production", "introspect").ios?.entitlements ?? {}
	);
};

describe("iOS authentication capabilities", () => {
	it("does not request Sign in with Apple for password-only authentication", () => {
		const finalEntitlements = readFinalExpoEntitlements();

		expect(finalEntitlements[SIGN_IN_WITH_APPLE_ENTITLEMENT]).toBeUndefined();

		if (existsSync(IOS_ENTITLEMENTS_PATH)) {
			expect(readFileSync(IOS_ENTITLEMENTS_PATH, "utf8")).not.toContain(
				SIGN_IN_WITH_APPLE_ENTITLEMENT,
			);
		}
	});
});
