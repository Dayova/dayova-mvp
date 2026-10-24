import { type ReactNode, type Ref, useState } from "react";
import { View } from "react-native";
import {
	KeyboardAvoidingView,
	type KeyboardAwareScrollViewRef,
	useKeyboardState,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardSafeScrollView } from "~/components/ui/keyboard-safe-scroll-view";

/** Keep actions pinned only while they leave most of the question area readable. */
export function SessionContentLayout({
	children,
	footer,
	horizontalPadding,
	keyboardEnabled,
	bounces,
	ref,
}: {
	children: ReactNode;
	footer?: ReactNode;
	horizontalPadding: number;
	keyboardEnabled: boolean;
	bounces: boolean;
	ref?: Ref<KeyboardAwareScrollViewRef>;
}) {
	const insets = useSafeAreaInsets();
	const [availableHeight, setAvailableHeight] = useState(0);
	const [footerHeight, setFooterHeight] = useState(0);
	const keyboardHeight = useKeyboardState((state) =>
		state.isVisible ? state.height : 0,
	);
	// The keyboard reduces the readable question area on both native platforms,
	// even when Android's edge-to-edge window stays full height behind it.
	const readableHeight = availableHeight - keyboardHeight;
	const scrollActions =
		availableHeight > 0 && footerHeight > readableHeight * 0.4;
	const actions = footer ? (
		<View
			testID="session-actions"
			onLayout={({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height)}
			className="border-border border-t-hairline bg-background pt-4"
			// Content-size padding and the home-indicator inset are native geometry.
			style={{
				paddingHorizontal: horizontalPadding,
				paddingBottom: Math.max(insets.bottom, 16),
			}}
		>
			{footer}
		</View>
	) : null;

	return (
		<View
			testID="session-body"
			className="flex-1"
			onLayout={({ nativeEvent }) =>
				setAvailableHeight(nativeEvent.layout.height)
			}
		>
			<KeyboardSafeScrollView
				testID="session-scroll"
				ref={ref}
				className="flex-1"
				bounces={bounces}
				enabled={keyboardEnabled}
				contentContainerStyle={{ flexGrow: 1 }}
			>
				<View
					className="flex-1"
					style={{
						paddingHorizontal: horizontalPadding,
						paddingBottom: footer ? 24 : Math.max(insets.bottom + 28, 60),
					}}
				>
					{children}
				</View>
				{scrollActions ? actions : null}
			</KeyboardSafeScrollView>
			{!scrollActions && actions ? (
				<KeyboardAvoidingView automaticOffset behavior="padding">
					{actions}
				</KeyboardAvoidingView>
			) : null}
		</View>
	);
}
