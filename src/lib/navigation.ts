import {
	type NavigationAction,
	useFocusEffect,
	useIsFocused,
	useNavigationContainerRef,
	usePreventRemove,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
	const isFocused = useIsFocused();
	const rootNavigation = useNavigationContainerRef();
	const isHandlingNativeBackRef = useRef(false);
	const [pendingRemoval, setPendingRemoval] = useState<NavigationAction | null>(
		null,
	);

	useEffect(() => {
		if (!pendingRemoval) return;
		// Commit the disabled guard before resuming. SDK 58's repeat() adds
		// the child source to parent-targeted actions; root dispatch preserves
		// the original target/source for nested replacements.
		rootNavigation.dispatch(pendingRemoval);
		// A parent guard may keep this route mounted. Restore protection after
		// the resumed action has had a frame to finish, or cancel on unmount.
		const frame = requestAnimationFrame(() => setPendingRemoval(null));
		return () => cancelAnimationFrame(frame);
	}, [pendingRemoval, rootNavigation]);

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
	usePreventRemove(
		enabled && isFocused && !allowRouteRemoval && pendingRemoval === null,
		({ data }) => {
			if (!isBackRemovalAction({ data }) || !runBackIntent()) {
				setPendingRemoval(data.action);
			}
		},
	);

	return runBackIntent;
};
