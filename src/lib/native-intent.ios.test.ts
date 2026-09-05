import { afterEach, describe, expect, it } from "vitest";
import {
	getPendingRevenueCatRedemptionUrl,
	resetRevenueCatRedemptionForTests,
} from "~/lib/revenuecat-redemption";
import { redirectNativeIntentPath } from "./native-intent-redirect.ios";

afterEach(() => {
	resetRevenueCatRedemptionForTests();
});

describe("iOS redirectSystemPath", () => {
	it("does not capture or route RevenueCat web-purchase redemption", () => {
		const url = "rc-abc123://redeem_web_purchase?redemption_token=secret-token";

		expect(redirectNativeIntentPath(url)).toBe(url);
		expect(getPendingRevenueCatRedemptionUrl()).toBeNull();
	});

	it("leaves ordinary Dayova links unchanged", () => {
		expect(redirectNativeIntentPath("dayova://learning-plans/123")).toBe(
			"dayova://learning-plans/123",
		);
	});
});
