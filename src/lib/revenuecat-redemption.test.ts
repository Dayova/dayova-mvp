import { afterEach, describe, expect, it, vi } from "vitest";
import {
	captureRevenueCatRedemptionUrl,
	clearPendingRevenueCatRedemptionUrl,
	getPendingRevenueCatRedemptionUrl,
	isRevenueCatRedemptionUrl,
	resetRevenueCatRedemptionForTests,
	subscribeToRevenueCatRedemptionUrl,
} from "./revenuecat-redemption";

const redemptionUrl =
	"rc-abc123://redeem_web_purchase?redemption_token=secret-token";

afterEach(() => resetRevenueCatRedemptionForTests());

describe("RevenueCat redemption link capture", () => {
	it("accepts only the generated redemption-link shape", () => {
		expect(isRevenueCatRedemptionUrl(redemptionUrl)).toBe(true);
		expect(
			isRevenueCatRedemptionUrl(
				"dayova://redeem_web_purchase?redemption_token=secret-token",
			),
		).toBe(false);
		expect(isRevenueCatRedemptionUrl("rc-abc123://redeem_web_purchase")).toBe(
			false,
		);
		expect(isRevenueCatRedemptionUrl("not a URL")).toBe(false);
	});

	it("keeps the token in memory and notifies the app shell", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeToRevenueCatRedemptionUrl(listener);

		expect(captureRevenueCatRedemptionUrl(redemptionUrl)).toBe(true);
		expect(getPendingRevenueCatRedemptionUrl()).toBe(redemptionUrl);
		expect(listener).toHaveBeenCalledTimes(1);

		clearPendingRevenueCatRedemptionUrl(redemptionUrl);
		expect(getPendingRevenueCatRedemptionUrl()).toBeNull();
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
	});

	it("does not clear a newer link when an older attempt finishes", () => {
		const newerUrl =
			"rc-abc123://redeem_web_purchase?redemption_token=newer-token";
		captureRevenueCatRedemptionUrl(redemptionUrl);
		captureRevenueCatRedemptionUrl(newerUrl);

		clearPendingRevenueCatRedemptionUrl(redemptionUrl);

		expect(getPendingRevenueCatRedemptionUrl()).toBe(newerUrl);
	});
});
