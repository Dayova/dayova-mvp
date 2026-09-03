import { describe, expect, it } from "vitest";
import {
	getNativeSubscriptionManagementUrl,
	getStoreName,
	getStoreSubscribeLabel,
} from "./store-subscription";

describe("Store subscription presentation", () => {
	it("uses native Store labels for each app platform", () => {
		expect(getStoreName("ios")).toBe("App Store");
		expect(getStoreName("android")).toBe("Google Play");
		expect(getStoreSubscribeLabel("ios")).toBe("Im App Store abonnieren");
		expect(getStoreSubscribeLabel("android")).toBe(
			"Bei Google Play abonnieren",
		);
	});

	it("opens only the matching native Store management page", () => {
		expect(
			getNativeSubscriptionManagementUrl({
				platform: "ios",
				store: "APP_STORE",
			}),
		).toBe("https://apps.apple.com/account/subscriptions");
		expect(
			getNativeSubscriptionManagementUrl({
				platform: "android",
				store: "PLAY_STORE",
			}),
		).toBe("https://play.google.com/store/account/subscriptions");
	});

	it("does not send web subscribers to external billing from a Store app", () => {
		expect(
			getNativeSubscriptionManagementUrl({
				platform: "ios",
				store: "STRIPE",
			}),
		).toBeUndefined();
		expect(
			getNativeSubscriptionManagementUrl({
				platform: "android",
				store: "PADDLE",
			}),
		).toBeUndefined();
	});
});
