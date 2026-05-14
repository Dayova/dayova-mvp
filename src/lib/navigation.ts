import type { Href } from "expo-router";
import { useFocusEffect, useNavigation } from "expo-router/react-navigation";
import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";

type Router = typeof import("expo-router").router;

const BACK_REMOVAL_ACTION_TYPES = new Set(["GO_BACK", "POP", "POP_TO_TOP"]);

const isBackRemovalAction = (event: {
	data?: { action?: { type?: string } };
}) => BACK_REMOVAL_ACTION_TYPES.has(event.data?.action?.type ?? "");

export const goBackOrReplace = (router: Router, fallback: Href) => {
	if (router.canGoBack()) {
		router.back();
		return;
	}

	router.replace(fallback);
};

const useAndroidBackHandler = (enabled: boolean, onBack: () => boolean) => {
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
				if (!isBackRemovalAction(event)) return;

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
