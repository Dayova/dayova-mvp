export const INTRO_DOT_COLLAPSED_WIDTH = 8;
export const INTRO_DOT_EXPANDED_WIDTH = 30;
export const INTRO_DOT_HEIGHT = 6;

export function getCenteredIntroDotsTop(
	titleBottom: number,
	buttonTop: number,
	dotsHeight: number,
) {
	return (titleBottom + buttonTop - dotsHeight) / 2;
}

export function getIntroPageIndex(
	offsetX: number,
	pageWidth: number,
	pageCount: number,
) {
	if (pageWidth <= 0 || pageCount <= 1) return 0;

	return Math.min(Math.max(Math.round(offsetX / pageWidth), 0), pageCount - 1);
}

export function getIntroButtonProgress(
	scrollOffset: number,
	pageWidth: number,
	pageCount: number,
) {
	"worklet";

	if (pageCount <= 0) return 0;
	if (pageWidth <= 0) return 1 / pageCount;

	const pageProgress = Math.min(
		Math.max(scrollOffset / pageWidth, 0),
		pageCount - 1,
	);

	return (pageProgress + 1) / pageCount;
}

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

export function getIntroInterpolatedValue(
	scrollOffset: number,
	pageWidth: number,
	values: readonly number[],
) {
	"worklet";

	if (values.length === 0) return 0;
	if (pageWidth <= 0 || values.length === 1) return values[0] ?? 0;

	const pageProgress = Math.min(
		Math.max(scrollOffset / pageWidth, 0),
		values.length - 1,
	);
	const startIndex = Math.floor(pageProgress);
	const endIndex = Math.min(startIndex + 1, values.length - 1);
	const progressBetweenPages = pageProgress - startIndex;
	const startValue = values[startIndex] ?? 0;
	const endValue = values[endIndex] ?? startValue;

	return startValue + (endValue - startValue) * progressBetweenPages;
}
