import {
	useFocusEffect,
	useIsFocused,
	useNavigation,
	usePreventRemove,
} from "expo-router/react-navigation";
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

export const useBackIntent = (
	enabled: boolean,
	onBack: () => boolean,
	{ allowRouteRemoval = false }: { allowRouteRemoval?: boolean } = {},
) => {
	const navigation = useNavigation();
	const isFocused = useIsFocused();
	const isHandlingNativeBackRef = useRef(false);

	const runBackIntent = useCallback(() => {
		if (isHandlingNativeBackRef.current) return true;

		isHandlingNativeBackRef.current = true;
		let handled: boolean;
		try {
			handled = onBack();
		} catch (error) {
			isHandlingNativeBackRef.current = false;
			throw error;
		}
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

	// Register prevention with the native stack as well as JS. A raw
	// beforeRemove listener runs too late to undo an iOS swipe dismissal.
	usePreventRemove(enabled && isFocused && !allowRouteRemoval, ({ data }) => {
		if (!isBackRemovalAction({ data }) || !runBackIntent()) {
			// Preserve even an absent source: dispatching from this child otherwise
			// injects its route key, which a targeted parent replacement cannot find.
			// Spreading the action also retains React Navigation's visited-route symbol.
			navigation.dispatch({ ...data.action, source: data.action.source });
		}
	});

	return runBackIntent;
};
