import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

type SheetAccessibilityContextValue = {
	hasOpenSheet: boolean;
	setSheetOpen: (sheetId: string, open: boolean) => void;
};

const SheetAccessibilityContext =
	createContext<SheetAccessibilityContextValue | null>(null);

function SheetAccessibilityProvider({ children }: { children: ReactNode }) {
	const [openSheetIds, setOpenSheetIds] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const setSheetOpen = useCallback((sheetId: string, open: boolean) => {
		setOpenSheetIds((current) => {
			const alreadyOpen = current.has(sheetId);
			if (alreadyOpen === open) return current;

			const next = new Set(current);
			if (open) {
				next.add(sheetId);
			} else {
				next.delete(sheetId);
			}
			return next;
		});
	}, []);
	const value = useMemo(
		() => ({ hasOpenSheet: openSheetIds.size > 0, setSheetOpen }),
		[openSheetIds, setSheetOpen],
	);

	return (
		<SheetAccessibilityContext.Provider value={value}>
			{children}
		</SheetAccessibilityContext.Provider>
	);
}

function useSheetAccessibility() {
	return useContext(SheetAccessibilityContext);
}

export { SheetAccessibilityProvider, useSheetAccessibility };
