export type DashboardDayDirection = -1 | 0 | 1;

const SWIPE_DISTANCE_THRESHOLD = 44;
const SWIPE_VELOCITY_THRESHOLD = 500;

export function resolveDashboardDaySwipe(
	translationX: number,
	velocityX: number,
): DashboardDayDirection {
	"worklet";

	if (
		Math.abs(translationX) < SWIPE_DISTANCE_THRESHOLD &&
		Math.abs(velocityX) < SWIPE_VELOCITY_THRESHOLD
	) {
		return 0;
	}

	const horizontalSignal =
		Math.abs(translationX) >= SWIPE_DISTANCE_THRESHOLD
			? translationX
			: velocityX;

	return horizontalSignal > 0 ? -1 : 1;
}
