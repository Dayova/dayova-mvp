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
		price: 14.99,
		currencyCode: "EUR",
		priceString: "€14.99",
	},
};
const annualPackage = {
	identifier: "$rc_annual",
	packageType: "ANNUAL",
	product: {
		identifier: "dayova_annual",
		price: 155.88,
		currencyCode: "EUR",
		pricePerMonth: 12.99,
		pricePerMonthString: "EUR12.99",
		priceString: "€155.88",
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

	it("uses the store amount and currency instead of hardcoded launch prices", async () => {
		const sdk = createSdk();
		sdk.getOfferings = vi.fn(async () => ({
			all: {},
			current: {
				availablePackages: [
					{
						...annualPackage,
						product: {
							...annualPackage.product,
							price: 15000,
							pricePerMonth: 1250,
							currencyCode: "JPY",
						},
					},
				],
			},
		}));
		const client = createRevenueCatClient({
			apiKey: "test",
			appUserId: "test",
			sdk,
		});

		await expect(client.getPlans()).resolves.toEqual([
			expect.objectContaining({ price: "15.000 ¥", pricePerMonth: "1.250 ¥" }),
		]);
	});

	it("preserves store text when numeric or currency data cannot be formatted", async () => {
		const sdk = createSdk();
		sdk.getOfferings = vi.fn(async () => ({
			all: {},
			current: {
				availablePackages: [
					{
						...annualPackage,
						product: {
							...annualPackage.product,
							currencyCode: "",
							pricePerMonth: null,
						},
					},
				],
			},
		}));
		const client = createRevenueCatClient({
			apiKey: "test",
			appUserId: "test",
			sdk,
		});

		await expect(client.getPlans()).resolves.toEqual([
			expect.objectContaining({ price: "€155.88", pricePerMonth: "EUR12.99" }),
		]);
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
});
