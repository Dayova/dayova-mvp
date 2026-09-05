import { useFocusEffect, useNavigation } from "expo-router/react-navigation";
import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";

export {
	dismissToOrReplace,
	goBackOrReplace,
	goBackToReturnOrReplace,
} from "./navigation-actions";

const BACK_REMOVAL_ACTION_TYPES = new Set(["GO_BACK", "POP", "POP_TO_TOP"]);

const isBackRemovalAction = (event: {
	data?: { action?: { type?: string } };
}) => BACK_REMOVAL_ACTION_TYPES.has(event.data?.action?.type ?? "");

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

	const runBackIntent = useCallback(() => {
		if (isHandlingNativeBackRef.current) return true;

		isHandlingNativeBackRef.current = true;
		const handled = onBack();
		if (!handled) {
			isHandlingNativeBackRef.current = false;
			return false;
		}

		requestAnimationFrame(() => {
			isHandlingNativeBackRef.current = false;
		});
		return true;
	}, [onBack]);

	useAndroidBackHandler(enabled, runBackIntent);

	useFocusEffect(
		useCallback(() => {
			if (!enabled) return undefined;

			const unsubscribe = navigation.addListener("beforeRemove", (event) => {
				if (!isBackRemovalAction(event)) return;

				// A route removal started by runBackIntent is the intended result of
				// the custom back control. Let that nested navigation action through.
				if (isHandlingNativeBackRef.current) return;

				const handled = runBackIntent();
				if (!handled) return;

				event.preventDefault();
			});

			return unsubscribe;
		}, [enabled, navigation, runBackIntent]),
	);

	return runBackIntent;
};
