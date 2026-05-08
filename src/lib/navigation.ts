import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { Href, Router } from "expo-router";
import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";

export const goBackOrReplace = (router: Router, fallback: Href) => {
	if (router.canGoBack()) {
		router.back();
		return;
	}

	router.replace(fallback);
};

const useAndroidBackHandler = (
	enabled: boolean,
	onBack: () => boolean,
) => {
	useFocusEffect(
		useCallback(() => {
			if (!enabled || Platform.OS !== "android") return undefined;

			const subscription = BackHandler.addEventListener(
				"hardwareBackPress",
				() => {
					return onBack();
				},
			);

			return () => subscription.remove();
		}, [enabled, onBack]),
	);
};

export const useBackIntent = (enabled: boolean, onBack: () => boolean) => {
	const navigation = useNavigation();
	const isHandlingNativeBackRef = useRef(false);

	useAndroidBackHandler(enabled, onBack);

	useFocusEffect(
		useCallback(() => {
			if (!enabled) return undefined;

			const unsubscribe = navigation.addListener("beforeRemove", (event) => {
				if (isHandlingNativeBackRef.current) {
					event.preventDefault();
					return;
				}

				const handled = onBack();
				if (!handled) return;

				isHandlingNativeBackRef.current = true;
				event.preventDefault();
				requestAnimationFrame(() => {
					isHandlingNativeBackRef.current = false;
				});
			});

			return unsubscribe;
		}, [enabled, navigation, onBack]),
	);
};
