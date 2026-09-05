import { describe, expect, it, vi } from "vitest";
import {
	type RevenueCatRedemptionSdkBoundary,
	redeemRevenueCatWebPurchase,
} from "./revenuecat-redemption-client";

const createSdk = (): RevenueCatRedemptionSdkBoundary => ({
	parseAsWebPurchaseRedemption: vi.fn(async (redemptionLink: string) => ({
		redemptionLink,
	})),
	redeemWebPurchase: vi.fn(async () => ({
		result: "SUCCESS" as const,
		customerInfo: { entitlements: { active: {} } },
	})),
});

describe("RevenueCat Android web-purchase redemption", () => {
	it("redeems a recognized RevenueCat link", async () => {
		const sdk = createSdk();
		const url = "rc-abc123://redeem_web_purchase?redemption_token=secret";

		await expect(redeemRevenueCatWebPurchase({ sdk, url })).resolves.toEqual({
			status: "redeemed",
		});
		expect(sdk.parseAsWebPurchaseRedemption).toHaveBeenCalledWith(url);
		expect(sdk.redeemWebPurchase).toHaveBeenCalledWith({
			redemptionLink: url,
		});
	});

	it.each([
		["EXPIRED", { status: "expired", obfuscatedEmail: "f***@example.com" }],
		["INVALID_TOKEN", { status: "invalidToken" }],
		["PURCHASE_BELONGS_TO_OTHER_USER", { status: "belongsToOtherUser" }],
	] as const)("maps the %s result", async (result, expected) => {
		const sdk = createSdk();
		sdk.redeemWebPurchase = vi.fn(async () =>
			result === "EXPIRED"
				? { result, obfuscatedEmail: "f***@example.com" }
				: { result },
		);

		await expect(
			redeemRevenueCatWebPurchase({ sdk, url: "rc-test://link" }),
		).resolves.toEqual(expected);
	});

	it("rejects links the SDK does not recognize", async () => {
		const sdk = createSdk();
		sdk.parseAsWebPurchaseRedemption = vi.fn(async () => null);

		await expect(
			redeemRevenueCatWebPurchase({ sdk, url: "rc-test://invalid" }),
		).resolves.toEqual({ status: "invalidToken" });
		expect(sdk.redeemWebPurchase).not.toHaveBeenCalled();
	});
});
