import { describe, expect, it, vi } from "vitest";
import {
	createRevenueCatClient,
	type RevenueCatSdkBoundary,
} from "./revenuecat-client";

const monthlyPackage = {
	identifier: "$rc_monthly",
	packageType: "MONTHLY",
	product: {
		identifier: "dayova_monthly",
		priceString: "14,99 €",
	},
};
const annualPackage = {
	identifier: "$rc_annual",
	packageType: "ANNUAL",
	product: {
		identifier: "dayova_annual",
		pricePerMonthString: "12,99 €",
		priceString: "155,88 €",
	},
};

const createSdk = (): RevenueCatSdkBoundary => ({
	configure: vi.fn(),
	getOfferings: vi.fn(async () => ({
		all: {
			default: {
				availablePackages: [annualPackage, monthlyPackage],
			},
		},
		current: null,
	})),
	purchasePackage: vi.fn(async () => ({
		customerInfo: {
			entitlements: {
				active: {
					dayova_full_access: {},
				},
			},
		},
	})),
	restorePurchases: vi.fn(async () => ({
		entitlements: {
			active: {
				dayova_full_access: {},
			},
		},
	})),
	parseAsWebPurchaseRedemption: vi.fn(async (redemptionLink: string) => ({
		redemptionLink,
	})),
	redeemWebPurchase: vi.fn(async () => ({
		result: "SUCCESS" as const,
		customerInfo: {
			entitlements: {
				active: {
					dayova_full_access: {},
				},
			},
		},
	})),
});

describe("createRevenueCatClient", () => {
	it("configures the account and reads the agreed default offering", async () => {
		const sdk = createSdk();
		const client = createRevenueCatClient({
			apiKey: "appl_test",
			appUserId: "clerk_user_1",
			sdk,
		});

		await expect(client.getPlans()).resolves.toEqual([
			{
				billingPeriod: "annual",
				packageIdentifier: "$rc_annual",
				price: "155,88 €",
				pricePerMonth: "12,99 €",
				productIdentifier: "dayova_annual",
			},
			{
				billingPeriod: "monthly",
				packageIdentifier: "$rc_monthly",
				price: "14,99 €",
				pricePerMonth: null,
				productIdentifier: "dayova_monthly",
			},
		]);
		expect(sdk.configure).toHaveBeenCalledWith({
			apiKey: "appl_test",
			appUserID: "clerk_user_1",
		});
	});

	it("unlocks only when RevenueCat returns the full-access entitlement", async () => {
		const client = createRevenueCatClient({
			apiKey: "appl_test",
			appUserId: "clerk_user_1",
			sdk: createSdk(),
		});

		await expect(client.purchase("monthly")).resolves.toEqual({
			status: "purchased",
		});
	});

	it("treats user-cancelled store sheets as a non-error result", async () => {
		const sdk = createSdk();
		sdk.purchasePackage = vi.fn(async () => {
			throw { userCancelled: true };
		});
		const client = createRevenueCatClient({
			apiKey: "appl_test",
			appUserId: "clerk_user_1",
			sdk,
		});

		await expect(client.purchase("monthly")).resolves.toEqual({
			status: "cancelled",
		});
	});

	it("restores purchases through the same full-access entitlement", async () => {
		const client = createRevenueCatClient({
			apiKey: "appl_test",
			appUserId: "clerk_user_1",
			sdk: createSdk(),
		});

		await expect(client.restore()).resolves.toEqual({
			status: "purchased",
		});
	});

	it("redeems a RevenueCat web purchase for the configured account", async () => {
		const sdk = createSdk();
		const client = createRevenueCatClient({
			apiKey: "appl_test",
			appUserId: "clerk_user_1",
			sdk,
		});
		const redemptionUrl =
			"rc-abc123://redeem_web_purchase?redemption_token=secret";

		await expect(client.redeemWebPurchase(redemptionUrl)).resolves.toEqual({
			status: "redeemed",
		});
		expect(sdk.parseAsWebPurchaseRedemption).toHaveBeenCalledWith(
			redemptionUrl,
		);
		expect(sdk.redeemWebPurchase).toHaveBeenCalledWith({
			redemptionLink: redemptionUrl,
		});
	});

	it.each([
		["EXPIRED", { status: "expired", obfuscatedEmail: "f***@example.com" }],
		["INVALID_TOKEN", { status: "invalidToken" }],
		["PURCHASE_BELONGS_TO_OTHER_USER", { status: "belongsToOtherUser" }],
	] as const)("maps the %s redemption result", async (result, expected) => {
		const sdk = createSdk();
		sdk.redeemWebPurchase = vi.fn(async () =>
			result === "EXPIRED"
				? { result, obfuscatedEmail: "f***@example.com" }
				: { result },
		);
		const client = createRevenueCatClient({
			apiKey: "appl_test",
			appUserId: "clerk_user_1",
			sdk,
		});

		await expect(client.redeemWebPurchase("rc-test://link")).resolves.toEqual(
			expected,
		);
	});

	it("rejects links the RevenueCat SDK does not recognize", async () => {
		const sdk = createSdk();
		sdk.parseAsWebPurchaseRedemption = vi.fn(async () => null);
		const client = createRevenueCatClient({
			apiKey: "appl_test",
			appUserId: "clerk_user_1",
			sdk,
		});

		await expect(
			client.redeemWebPurchase("rc-test://invalid"),
		).resolves.toEqual({
			status: "invalidToken",
		});
		expect(sdk.redeemWebPurchase).not.toHaveBeenCalled();
	});
});
