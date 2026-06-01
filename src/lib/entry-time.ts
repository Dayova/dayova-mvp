export const getMinutesSinceStartOfDay = (date: Date) =>
	date.getHours() * 60 + date.getMinutes();

export const getDurationBetweenTimes = (start: Date, end: Date) => {
	const startMinutes = getMinutesSinceStartOfDay(start);
	const endMinutes = getMinutesSinceStartOfDay(end);
	return Math.max(endMinutes - startMinutes, 15);
};

export const shiftEndTimeForStartChange = ({
	previousStart,
	previousEnd,
	nextStart,
}: {
	previousStart: Date;
	previousEnd: Date;
	nextStart: Date;
}) => {
	const durationMinutes = getDurationBetweenTimes(previousStart, previousEnd);
	const nextEnd = new Date(nextStart);
	nextEnd.setMinutes(nextStart.getMinutes() + durationMinutes);
	return nextEnd;
};
