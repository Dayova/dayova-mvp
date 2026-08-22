import { describe, expect, it } from "vitest";
import { getRevenueCatRedemptionScheme } from "./revenuecat-redemption-config";

describe("getRevenueCatRedemptionScheme", () => {
	it("normalizes the RevenueCat dashboard scheme", () => {
		expect(getRevenueCatRedemptionScheme(" RC-AbC123: ")).toBe("rc-abc123");
	});

	it("allows local builds without a redemption scheme", () => {
		expect(getRevenueCatRedemptionScheme(undefined)).toBeNull();
	});

	it("requires a scheme for release builds", () => {
		expect(() =>
			getRevenueCatRedemptionScheme(undefined, { required: true }),
		).toThrow(/REVENUECAT_REDEMPTION_SCHEME is required/);
	});

	it("rejects non-RevenueCat schemes", () => {
		expect(() => getRevenueCatRedemptionScheme("dayova")).toThrow(
			/must match the rc-/,
		);
	});
});
