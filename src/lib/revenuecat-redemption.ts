const REVENUECAT_REDEMPTION_HOST = "redeem_web_purchase";
const REVENUECAT_REDEMPTION_SCHEME_PATTERN = /^rc-[a-z0-9]+:$/;

let pendingRedemptionUrl: string | null = null;
const listeners = new Set<() => void>();

const emitChange = () => {
	for (const listener of listeners) listener();
};

export const isRevenueCatRedemptionUrl = (value: string) => {
	try {
		const url = new URL(value);
		return (
			REVENUECAT_REDEMPTION_SCHEME_PATTERN.test(url.protocol) &&
			url.hostname === REVENUECAT_REDEMPTION_HOST &&
			Boolean(url.searchParams.get("redemption_token"))
		);
	} catch {
		return false;
	}
};

export const captureRevenueCatRedemptionUrl = (value: string) => {
	if (!isRevenueCatRedemptionUrl(value)) return false;

	pendingRedemptionUrl = value;
	emitChange();
	return true;
};

export const getPendingRevenueCatRedemptionUrl = () => pendingRedemptionUrl;

export const clearPendingRevenueCatRedemptionUrl = (expectedUrl: string) => {
	if (pendingRedemptionUrl !== expectedUrl) return;
	pendingRedemptionUrl = null;
	emitChange();
};

export const subscribeToRevenueCatRedemptionUrl = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const resetRevenueCatRedemptionForTests = () => {
	pendingRedemptionUrl = null;
	listeners.clear();
};
