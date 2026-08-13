import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
	createPendingOnboardingSyncOutbox,
	type PendingOnboardingSyncStorage,
} from "~/lib/pending-onboarding-sync";

const WEB_STORAGE_PREFIX = "dayova.secure-fallback:";

const secureStorage: PendingOnboardingSyncStorage = {
	getItem: async (key) => {
		if (Platform.OS === "web") {
			return (
				globalThis.localStorage?.getItem(`${WEB_STORAGE_PREFIX}${key}`) ?? null
			);
		}
		return SecureStore.getItemAsync(key);
	},
	setItem: async (key, value) => {
		if (Platform.OS === "web") {
			globalThis.localStorage?.setItem(`${WEB_STORAGE_PREFIX}${key}`, value);
			return;
		}
		await SecureStore.setItemAsync(key, value, {
			keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
		});
	},
	deleteItem: async (key) => {
		if (Platform.OS === "web") {
			globalThis.localStorage?.removeItem(`${WEB_STORAGE_PREFIX}${key}`);
			return;
		}
		await SecureStore.deleteItemAsync(key);
	},
};

export const pendingOnboardingSyncOutbox = createPendingOnboardingSyncOutbox({
	storage: secureStorage,
});

export const getOnboardingAccountFingerprint = (email: string) =>
	Crypto.digestStringAsync(
		Crypto.CryptoDigestAlgorithm.SHA256,
		email.trim().toLowerCase(),
	);
