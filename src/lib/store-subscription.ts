export type StorePlatform = string | undefined;

export const getStoreName = (platform: StorePlatform) =>
	platform === "ios"
		? "App Store"
		: platform === "android"
			? "Google Play"
			: "Store";

export const getStoreSubscribeLabel = (platform: StorePlatform) =>
	platform === "ios"
		? "Im App Store abonnieren"
		: platform === "android"
			? "Bei Google Play abonnieren"
			: "Im Store abonnieren";

export const getNativeSubscriptionManagementUrl = ({
	platform,
	store,
}: {
	platform: StorePlatform;
	store?: string;
}) => {
	const normalizedStore = store?.toLowerCase();
	if (
		platform === "ios" &&
		(normalizedStore?.includes("app_store") ||
			normalizedStore?.includes("apple"))
	) {
		return "https://apps.apple.com/account/subscriptions";
	}
	if (
		platform === "android" &&
		(normalizedStore?.includes("play_store") ||
			normalizedStore?.includes("google"))
	) {
		return "https://play.google.com/store/account/subscriptions";
	}
	return undefined;
};
