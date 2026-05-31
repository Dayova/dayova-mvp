import { forwardRef } from "react";
import { Platform } from "react-native";
import {
	KeyboardAwareScrollView,
	type KeyboardAwareScrollViewProps,
	type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import {
	getKeyboardSafeScrollConfig,
	type KeyboardSafeScrollOptions,
} from "~/components/ui/keyboard-safe-scroll";

type KeyboardSafeScrollViewProps = Omit<
	KeyboardAwareScrollViewProps,
	| "automaticallyAdjustKeyboardInsets"
	| "bottomOffset"
	| "extraKeyboardSpace"
	| "keyboardDismissMode"
	| "keyboardShouldPersistTaps"
	| "mode"
	| "showsVerticalScrollIndicator"
> &
	KeyboardSafeScrollOptions;

const KeyboardSafeScrollView = forwardRef<
	KeyboardAwareScrollViewRef,
	KeyboardSafeScrollViewProps
>(function KeyboardSafeScrollView(
	{ bottomOffset, extraKeyboardSpace, ...props },
	ref,
) {
	const keyboardConfig = getKeyboardSafeScrollConfig(Platform.OS, {
		bottomOffset,
		extraKeyboardSpace,
	});

	return <KeyboardAwareScrollView ref={ref} {...keyboardConfig} {...props} />;
});

export { KeyboardSafeScrollView };
