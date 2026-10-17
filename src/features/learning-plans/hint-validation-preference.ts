import { applicationId } from "expo-application";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export type HintVariant = "inline" | "extra";
export const isHintValidationAvailable =
	__DEV__ ||
	Constants.expoConfig?.extra?.internalHintValidation === true ||
	applicationId === "com.dayova.dev" ||
	applicationId === "com.dayova.validation" ||
	applicationId === "de.dayova.app-dev";
const STORAGE_KEY = "dayova.hint-validation.variant.v1";

export async function readHintVariant(): Promise<HintVariant> {
	if (!isHintValidationAvailable) return "inline";
	const stored =
		Platform.OS === "web"
			? globalThis.localStorage?.getItem(STORAGE_KEY)
			: await SecureStore.getItemAsync(STORAGE_KEY);
	return stored === "extra" ? "extra" : "inline";
}

export async function writeHintVariant(variant: HintVariant) {
	if (!isHintValidationAvailable) return;
	if (Platform.OS === "web") {
		if (!globalThis.localStorage)
			throw new Error("Testspeicher nicht verfügbar.");
		globalThis.localStorage.setItem(STORAGE_KEY, variant);
	} else await SecureStore.setItemAsync(STORAGE_KEY, variant);
}

/** Freeze assignment for this mounted flow; no student-facing switch or randomization. */
export function useHintVariant() {
	const [variant, setVariant] = useState<HintVariant | null>(
		isHintValidationAvailable ? null : "inline",
	);
	const [error, setError] = useState(false);
	useEffect(() => {
		let active = true;
		readHintVariant()
			.then((value) => {
				if (active) setVariant(value);
			})
			.catch(() => {
				if (active) setError(true);
			});
		return () => {
			active = false;
		};
	}, []);
	return { variant, error };
}
