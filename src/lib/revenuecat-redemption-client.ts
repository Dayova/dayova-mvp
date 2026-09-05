import { createNativeRevenueCatClient } from "./revenuecat-client";

type RevenueCatCustomerInfo = {
	entitlements: {
		active: Record<string, unknown>;
	};
};

type RevenueCatWebPurchaseRedemption = {
	redemptionLink: string;
};

type RevenueCatWebPurchaseRedemptionResult =
	| { result: "SUCCESS"; customerInfo: RevenueCatCustomerInfo }
	| { result: "ERROR"; error: unknown }
	| { result: "PURCHASE_BELONGS_TO_OTHER_USER" }
	| { result: "INVALID_TOKEN" }
	| { result: "EXPIRED"; obfuscatedEmail: string };

export type RevenueCatRedemptionSdkBoundary = {
	parseAsWebPurchaseRedemption: (
		url: string,
	) => Promise<RevenueCatWebPurchaseRedemption | null>;
	redeemWebPurchase: (
		redemption: RevenueCatWebPurchaseRedemption,
	) => Promise<RevenueCatWebPurchaseRedemptionResult>;
};

export type WebPurchaseRedemptionResult =
	| { status: "redeemed" }
	| { status: "expired"; obfuscatedEmail: string }
	| { status: "invalidToken" }
	| { status: "belongsToOtherUser" }
	| { status: "error"; error: unknown };

export const redeemRevenueCatWebPurchase = async ({
	sdk,
	url,
}: {
	sdk: RevenueCatRedemptionSdkBoundary;
	url: string;
}): Promise<WebPurchaseRedemptionResult> => {
	const redemption = await sdk.parseAsWebPurchaseRedemption(url);
	if (!redemption) return { status: "invalidToken" };

	const result = await sdk.redeemWebPurchase(redemption);
	switch (result.result) {
		case "SUCCESS":
			return { status: "redeemed" };
		case "EXPIRED":
			return {
				status: "expired",
				obfuscatedEmail: result.obfuscatedEmail,
			};
		case "PURCHASE_BELONGS_TO_OTHER_USER":
			return { status: "belongsToOtherUser" };
		case "INVALID_TOKEN":
			return { status: "invalidToken" };
		case "ERROR":
			return { status: "error", error: result.error };
	}
};

export const createNativeRevenueCatRedemptionClient = ({
	apiKey,
	appUserId,
}: {
	apiKey: string;
	appUserId: string;
}) => {
	createNativeRevenueCatClient({ apiKey, appUserId });
	const purchasesModule =
		require("react-native-purchases") as typeof import("react-native-purchases");
	const sdk = (purchasesModule.default ??
		purchasesModule) as unknown as RevenueCatRedemptionSdkBoundary;

	return {
		redeemWebPurchase: (url: string) =>
			redeemRevenueCatWebPurchase({ sdk, url }),
	};
};
