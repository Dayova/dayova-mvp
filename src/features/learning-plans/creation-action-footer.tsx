import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shouldUseKeyboardStickyActions } from "~/components/ui/keyboard-safe-scroll";

/** Shared bottom position for every step of exam creation. */
export function CreationActionFooter({
	children,
	followKeyboard = shouldUseKeyboardStickyActions(Platform.OS),
}: {
	children: ReactNode;
	followKeyboard?: boolean;
}) {
	const insets = useSafeAreaInsets();
	return (
		<KeyboardStickyView enabled={followKeyboard}>
			<View
				className="bg-background px-6"
				style={{ paddingBottom: Math.max(insets.bottom + 10, 24) }}
			>
				{children}
			</View>
		</KeyboardStickyView>
	);
}
