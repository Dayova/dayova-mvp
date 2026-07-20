import { useSyncExternalStore } from "react";
import type { ResolvedTheme } from "~/lib/theme-preference";
import DayovaSystemAppearance from "../../modules/dayova-system-appearance";

// Decision: docs/contexts/mobile-app/adr/0001-use-local-ios-system-appearance-bridge.md
const getSnapshot = () => DayovaSystemAppearance.getColorScheme();

const subscribe = (onStoreChange: () => void) => {
	const subscription = DayovaSystemAppearance.addListener(
		"onChange",
		onStoreChange,
	);

	return () => subscription.remove();
};

export function useSystemColorScheme(): ResolvedTheme {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
