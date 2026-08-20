import { afterEach, describe, expect, it } from "vitest";
import { redirectSystemPath } from "~/app/+native-intent";
import {
	getPendingRevenueCatRedemptionUrl,
	resetRevenueCatRedemptionForTests,
} from "~/lib/revenuecat-redemption";

afterEach(() => resetRevenueCatRedemptionForTests());

describe("redirectSystemPath", () => {
	it("captures RevenueCat links without exposing the token as a route param", () => {
		const url = "rc-abc123://redeem_web_purchase?redemption_token=secret-token";

		expect(redirectSystemPath({ path: url, initial: true })).toBe("/");
		expect(getPendingRevenueCatRedemptionUrl()).toBe(url);
	});

	it("leaves ordinary app links unchanged", () => {
		expect(
			redirectSystemPath({
				path: "dayova://learning-plans/123",
				initial: false,
			}),
		).toBe("dayova://learning-plans/123");
	});
});
