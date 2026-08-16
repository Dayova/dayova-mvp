import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IOS_ENTITLEMENTS_PATH = resolve(
	process.cwd(),
	"ios/Dayova/Dayova.entitlements",
);
const SIGN_IN_WITH_APPLE_ENTITLEMENT = "com.apple.developer.applesignin";

const readFinalExpoEntitlements = () => {
	const output = execFileSync(
		"npx",
		["expo", "config", "--type", "introspect", "--json"],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				APP_VARIANT: "production",
			},
		},
	);

	return JSON.parse(output).ios?.entitlements ?? {};
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
	}, 15_000);
});
