export const sessionContentTopPadding = 80;
export const sessionQuestionHorizontalPadding = 24;
export const sessionQuestionMaxWidth = 345;

const sessionHeaderHeight = 48;
const centeredQuestionTopInset = sessionContentTopPadding + sessionHeaderHeight;

export const getCenteredQuestionRegionHeight = (viewportHeight: number) =>
	Math.max(0, viewportHeight - 2 * centeredQuestionTopInset);

export const getCenteredQuestionRegionCenter = (viewportHeight: number) =>
	centeredQuestionTopInset +
	getCenteredQuestionRegionHeight(viewportHeight) / 2;

export const getQuestionContentWidth = (viewportWidth: number) =>
	Math.min(
		sessionQuestionMaxWidth,
		Math.max(0, viewportWidth - 2 * sessionQuestionHorizontalPadding),
	);

export const getStableViewportHeight = (
	stableViewportHeight: number,
	observedViewportHeight: number,
	isKeyboardVisible: boolean,
) => (isKeyboardVisible ? stableViewportHeight : observedViewportHeight);
