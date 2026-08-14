import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
	createPendingOnboardingSyncOutbox,
	type PendingOnboardingSyncStorage,
} from "~/lib/pending-onboarding-sync";

const WEB_STORAGE_PREFIX = "dayova.secure-fallback:";

type WebStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StorageOptions = {
	platform?: string;
	isDevelopment?: boolean;
	webStorage?: WebStorage;
};

export const createPendingOnboardingSyncStorage = ({
	platform = Platform.OS,
	isDevelopment = __DEV__,
	webStorage = globalThis.localStorage,
}: StorageOptions = {}): PendingOnboardingSyncStorage => {
	const getDevelopmentWebStorage = () => {
		if (!isDevelopment) {
			throw new Error(
				"Production web onboarding recovery is unsupported without encrypted storage.",
			);
		}
		if (!webStorage) {
			throw new Error("Development web storage is unavailable.");
		}
		return webStorage;
	};

	return {
		getItem: async (key) => {
			if (platform === "web") {
				return (
					getDevelopmentWebStorage().getItem(`${WEB_STORAGE_PREFIX}${key}`) ??
					null
				);
			}
			return SecureStore.getItemAsync(key);
		},
		setItem: async (key, value) => {
			if (platform === "web") {
				getDevelopmentWebStorage().setItem(
					`${WEB_STORAGE_PREFIX}${key}`,
					value,
				);
				return;
			}
			await SecureStore.setItemAsync(key, value, {
				keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
			});
		},
		deleteItem: async (key) => {
			if (platform === "web") {
				getDevelopmentWebStorage().removeItem(`${WEB_STORAGE_PREFIX}${key}`);
				return;
			}
			await SecureStore.deleteItemAsync(key);
		},
	};
};

const secureStorage = createPendingOnboardingSyncStorage();

export const pendingOnboardingSyncOutbox = createPendingOnboardingSyncOutbox({
	storage: secureStorage,
});

export const getOnboardingAccountFingerprint = (email: string) =>
	Crypto.digestStringAsync(
		Crypto.CryptoDigestAlgorithm.SHA256,
		email.trim().toLowerCase(),
	);
