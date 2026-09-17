import { shouldUseKeyboardStickyActions } from "~/components/ui/keyboard-safe-scroll";

type LearningSessionPlatform = "ios" | "android" | "web" | "windows" | "macos";

const MINIMUM_QUESTION_ACTION_HEIGHT = 56;
const QUESTION_ACTION_TOP_PADDING = 16;
const MINIMUM_ACTION_BOTTOM_PADDING = 16;
const DEFAULT_SCROLL_BOTTOM_OFFSET = 24;

const getLearningSessionKeyboardLayout = (
	platform: LearningSessionPlatform,
	bottomInset: number,
	measuredActionFooterHeight?: number | null,
) => {
	const footerBottomPadding = Math.max(
		bottomInset,
		MINIMUM_ACTION_BOTTOM_PADDING,
	);
	const stickyActionsEnabled = shouldUseKeyboardStickyActions(platform);
	const minimumActionFooterHeight =
		MINIMUM_QUESTION_ACTION_HEIGHT +
		QUESTION_ACTION_TOP_PADDING +
		footerBottomPadding;

	return {
		footerBottomPadding,
		scrollBottomOffset: stickyActionsEnabled
			? Math.max(measuredActionFooterHeight ?? 0, minimumActionFooterHeight)
			: DEFAULT_SCROLL_BOTTOM_OFFSET,
		stickyActionsEnabled,
	};
};

export { getLearningSessionKeyboardLayout };
