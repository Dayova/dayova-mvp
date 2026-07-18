type AuthContentSizeLayoutInput = {
	fontScale: number;
	shouldStackInlineContent: boolean;
};

type OtpCellLayout = {
	height: number;
	width?: number;
};

type ResponsiveAuthChoiceLayout = {
	brandFontSize: number;
	brandLineHeight: number;
	bodyFontSize: number;
	bodyLineHeight: number;
	buttonMinHeight: number;
	termsFontSize: number;
	termsLineHeight: number;
	verticallyCenterContent: boolean;
};

type RangeValueContentLayout = {
	unitMarginTop: number;
	verticalOffset: number;
};

function getOtpCellLayout({
	fontScale,
	shouldStackInlineContent,
}: AuthContentSizeLayoutInput): OtpCellLayout {
	if (!shouldStackInlineContent) {
		return { height: 42 };
	}

	return {
		height: Math.max(42, 28 * fontScale + 14),
		width: Math.max(42, 22 * fontScale + 16),
	};
}

function getRangeValueBadgeSize({
	fontScale,
	shouldStackInlineContent,
}: AuthContentSizeLayoutInput): number {
	if (!shouldStackInlineContent) return 88;

	const scaledTextHeight = (36 + 15) * fontScale - 4;
	const ringStrokeWidth = 4;
	const innerVerticalPadding = 12;
	return Math.max(
		88,
		scaledTextHeight + 2 * (ringStrokeWidth + innerVerticalPadding),
	);
}

function getRangeValueContentLayout(
	fontScale: number,
): RangeValueContentLayout {
	return {
		unitMarginTop: 2 - 10 * fontScale,
		verticalOffset: -2 * fontScale,
	};
}

function getResponsiveAuthChoiceLayout(
	fontScale: number,
): ResponsiveAuthChoiceLayout {
	const brandScale = Math.min(fontScale, 1.5);
	const bodyLineHeight = 24 * fontScale;

	return {
		brandFontSize: 32 * brandScale,
		brandLineHeight: 48 * brandScale,
		bodyFontSize: 16 * fontScale,
		bodyLineHeight,
		buttonMinHeight: Math.max(56, bodyLineHeight + 24),
		termsFontSize: 12 * fontScale,
		termsLineHeight: 18 * fontScale,
		verticallyCenterContent: fontScale < 1.5,
	};
}

export {
	getOtpCellLayout,
	getRangeValueBadgeSize,
	getRangeValueContentLayout,
	getResponsiveAuthChoiceLayout,
};
