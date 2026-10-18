export const INTRO_DOT_COLLAPSED_WIDTH = 8;
export const INTRO_DOT_EXPANDED_WIDTH = 30;

export function getIntroDotWidth(
	scrollOffset: number,
	pageWidth: number,
	dotIndex: number,
	pageCount: number,
) {
	"worklet";

	if (pageWidth <= 0) {
		return dotIndex === 0
			? INTRO_DOT_EXPANDED_WIDTH
			: INTRO_DOT_COLLAPSED_WIDTH;
	}

	const pageProgress = Math.min(
		Math.max(scrollOffset / pageWidth, 0),
		Math.max(pageCount - 1, 0),
	);
	const distanceFromDot = Math.min(Math.abs(pageProgress - dotIndex), 1);

	return (
		INTRO_DOT_COLLAPSED_WIDTH +
		(INTRO_DOT_EXPANDED_WIDTH - INTRO_DOT_COLLAPSED_WIDTH) *
			(1 - distanceFromDot)
	);
}
