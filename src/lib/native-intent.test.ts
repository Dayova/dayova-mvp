import { afterEach, describe, expect, it } from "vitest";
import {
	getPendingRevenueCatRedemptionUrl,
	resetRevenueCatRedemptionForTests,
} from "~/lib/revenuecat-redemption";
import { redirectNativeIntentPath } from "./native-intent-redirect";

afterEach(() => resetRevenueCatRedemptionForTests());

describe("redirectSystemPath", () => {
	it("captures RevenueCat links without exposing the token as a route param", () => {
		const url = "rc-abc123://redeem_web_purchase?redemption_token=secret-token";

		expect(redirectNativeIntentPath(url)).toBe("/");
		expect(getPendingRevenueCatRedemptionUrl()).toBe(url);
	});

	it("leaves ordinary app links unchanged", () => {
		expect(redirectNativeIntentPath("dayova://learning-plans/123")).toBe(
			"dayova://learning-plans/123",
		);
	});
});
