const DEFAULT_CONTAINER_MAX_WIDTH = 480;
const DEFAULT_HORIZONTAL_PADDING = 32;
const COMPACT_VIEWPORT_WIDTH = 360;
const VERY_COMPACT_VIEWPORT_WIDTH = 300;
const COMPACT_HORIZONTAL_PADDING = 20;
const VERY_COMPACT_HORIZONTAL_PADDING = 16;
const ENLARGED_FONT_SCALE = 1.2;

type ContentSizeLayoutInput = {
	containerMaxWidth?: number;
	fontScale: number;
	requestedHorizontalPadding?: number;
	viewportWidth: number;
};

type ContentSizeLayout = {
	containerMaxWidth: number;
	horizontalPadding: number;
	shouldStackInlineContent: boolean;
	usableWidth: number;
};

function getContentSizeLayout({
	containerMaxWidth = DEFAULT_CONTAINER_MAX_WIDTH,
	fontScale,
	requestedHorizontalPadding = DEFAULT_HORIZONTAL_PADDING,
	viewportWidth,
}: ContentSizeLayoutInput): ContentSizeLayout {
	const viewportHorizontalPadding =
		viewportWidth < VERY_COMPACT_VIEWPORT_WIDTH
			? Math.min(requestedHorizontalPadding, VERY_COMPACT_HORIZONTAL_PADDING)
			: viewportWidth < COMPACT_VIEWPORT_WIDTH
				? Math.min(requestedHorizontalPadding, COMPACT_HORIZONTAL_PADDING)
				: requestedHorizontalPadding;
	const horizontalPadding =
		fontScale >= ENLARGED_FONT_SCALE
			? Math.min(viewportHorizontalPadding, COMPACT_HORIZONTAL_PADDING)
			: viewportHorizontalPadding;
	const boundedContentWidth = Math.min(viewportWidth, containerMaxWidth);

	return {
		containerMaxWidth,
		horizontalPadding,
		shouldStackInlineContent:
			viewportWidth < COMPACT_VIEWPORT_WIDTH ||
			fontScale >= ENLARGED_FONT_SCALE,
		usableWidth: Math.max(0, boundedContentWidth - horizontalPadding * 2),
	};
}

export { getContentSizeLayout };
