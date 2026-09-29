import { createContext, type ReactNode, useContext } from "react";
import {
	type EdgeInsets,
	useSafeAreaInsets,
} from "react-native-safe-area-context";

const SheetSafeAreaContext = createContext<EdgeInsets | null>(null);

// Capture the screen insets above navigation: tab screens may add their tab bar
// to the bottom inset, but the root sheet host already covers that bar.
function SheetSafeAreaProvider({ children }: { children: ReactNode }) {
	const insets = useSafeAreaInsets();
	return (
		<SheetSafeAreaContext.Provider value={insets}>
			{children}
		</SheetSafeAreaContext.Provider>
	);
}

function useSheetSafeAreaInsets() {
	const screenInsets = useContext(SheetSafeAreaContext);
	const localInsets = useSafeAreaInsets();
	return screenInsets ?? localInsets;
}

export { SheetSafeAreaProvider, useSheetSafeAreaInsets };
