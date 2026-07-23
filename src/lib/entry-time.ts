const getMinutesSinceStartOfDay = (date: Date) =>
	date.getHours() * 60 + date.getMinutes();

export const MIN_EXAM_DURATION_MINUTES = 3;
export const MAX_EXAM_DURATION_MINUTES = 6 * 60;

type DurationOptions = {
	minimumMinutes?: number;
	maximumMinutes?: number;
};

export const getDurationBetweenTimes = (
	start: Date,
	end: Date,
	{
		minimumMinutes = 15,
		maximumMinutes = Number.POSITIVE_INFINITY,
	}: DurationOptions = {},
) => {
	const sameCalendarDay =
		start.getFullYear() === end.getFullYear() &&
		start.getMonth() === end.getMonth() &&
		start.getDate() === end.getDate();
	const durationMinutes = sameCalendarDay
		? getMinutesSinceStartOfDay(end) - getMinutesSinceStartOfDay(start)
		: Math.round((end.getTime() - start.getTime()) / 60_000);

	return Math.min(Math.max(durationMinutes, minimumMinutes), maximumMinutes);
};

export const constrainEndTimeForStart = ({
	start,
	end,
	minimumMinutes,
	maximumMinutes,
}: {
	start: Date;
	end: Date;
	minimumMinutes?: number;
	maximumMinutes?: number;
}) => {
	const constrainedEnd = new Date(start);
	constrainedEnd.setMinutes(
		start.getMinutes() +
			getDurationBetweenTimes(start, end, {
				minimumMinutes,
				maximumMinutes,
			}),
	);
	return constrainedEnd;
};

export const shiftEndTimeForStartChange = ({
	previousStart,
	previousEnd,
	nextStart,
	minimumMinutes,
	maximumMinutes,
}: {
	previousStart: Date;
	previousEnd: Date;
	nextStart: Date;
	minimumMinutes?: number;
	maximumMinutes?: number;
}) => {
	const durationMinutes = getDurationBetweenTimes(previousStart, previousEnd, {
		minimumMinutes,
		maximumMinutes,
	});
	const nextEnd = new Date(nextStart);
	nextEnd.setMinutes(nextStart.getMinutes() + durationMinutes);
	return nextEnd;
};
