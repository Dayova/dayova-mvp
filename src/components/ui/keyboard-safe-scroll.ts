type KeyboardSafePlatform = "ios" | "android" | "web" | "windows" | "macos";

type KeyboardSafeScrollOptions = {
	bottomOffset?: number;
	extraKeyboardSpace?: number;
};

type KeyboardSafeScrollConfig = {
	automaticallyAdjustKeyboardInsets: boolean;
	bottomOffset: number;
	extraKeyboardSpace: number;
	keyboardDismissMode: "interactive" | "on-drag";
	keyboardShouldPersistTaps: "handled";
	mode: "layout";
	showsVerticalScrollIndicator: false;
};

function shouldUseKeyboardStickyActions(platform: KeyboardSafePlatform) {
	return platform === "ios";
}

function getKeyboardSafeScrollConfig(
	platform: KeyboardSafePlatform,
	options: KeyboardSafeScrollOptions = {},
): KeyboardSafeScrollConfig {
	return {
		automaticallyAdjustKeyboardInsets: false,
		bottomOffset: options.bottomOffset ?? 24,
		extraKeyboardSpace: options.extraKeyboardSpace ?? 0,
		keyboardDismissMode: platform === "ios" ? "interactive" : "on-drag",
		keyboardShouldPersistTaps: "handled",
		mode: "layout",
		showsVerticalScrollIndicator: false,
	};
}

export type { KeyboardSafeScrollOptions };
export { getKeyboardSafeScrollConfig, shouldUseKeyboardStickyActions };
