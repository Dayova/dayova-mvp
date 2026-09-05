import { captureRevenueCatRedemptionUrl } from "./revenuecat-redemption";

export const redirectNativeIntentPath = (path: string) => {
	try {
		return captureRevenueCatRedemptionUrl(path) ? "/" : path;
	} catch {
		return "/";
	}
};
