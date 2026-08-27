import { captureRevenueCatRedemptionUrl } from "~/lib/revenuecat-redemption";

export function redirectSystemPath({
	path,
}: {
	path: string;
	initial: boolean;
}) {
	try {
		return captureRevenueCatRedemptionUrl(path) ? "/" : path;
	} catch {
		return "/";
	}
}
