export type LearningTimeWindow = {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

export type OccupiedLearningTime = {
	dayKey: string;
	time?: string;
	durationMinutes?: number;
};

const MIN_LEARNING_SLOT_MINUTES = 10;
const MAX_WINDOW_MINUTES = 120;

const parseTimeToMinutes = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours === undefined ||
		minutes === undefined ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}
	return hours * 60 + minutes;
};

const getOccupiedIntervalsByDay = (occupiedEntries: OccupiedLearningTime[]) => {
	const intervalsByDay = new Map<
		string,
		Array<{ start: number; end: number }>
	>();

	for (const entry of occupiedEntries) {
		if (!entry.time || !entry.durationMinutes || entry.durationMinutes <= 0) {
			continue;
		}
		const start = parseTimeToMinutes(entry.time);
		if (start === null) continue;

		const intervals = intervalsByDay.get(entry.dayKey) ?? [];
		intervals.push({ start, end: start + entry.durationMinutes });
		intervalsByDay.set(entry.dayKey, intervals);
	}

	return intervalsByDay;
};

const getFreeWindowMinutes = ({
	start,
	end,
	occupiedIntervals,
}: {
	start: number;
	end: number;
	occupiedIntervals: Array<{ start: number; end: number }>;
}) => {
	let freeIntervals = [{ start, end }];

	for (const occupied of occupiedIntervals) {
		freeIntervals = freeIntervals.flatMap((free) => {
			if (occupied.start >= free.end || occupied.end <= free.start) {
				return [free];
			}

			return [
				{ start: free.start, end: Math.max(free.start, occupied.start) },
				{ start: Math.min(free.end, occupied.end), end: free.end },
			];
		});
	}

	const usableMinutes = freeIntervals.reduce(
		(total, interval) =>
			interval.end - interval.start >= MIN_LEARNING_SLOT_MINUTES
				? total + interval.end - interval.start
				: total,
		0,
	);
	return Math.min(MAX_WINDOW_MINUTES, usableMinutes);
};

export const calculateAvailableStudyMinutes = ({
	fromDateKey,
	fromTimeMinutes,
	examDateKey,
	learningTimes,
	occupiedEntries = [],
}: {
	fromDateKey: string;
	fromTimeMinutes?: number;
	examDateKey: string;
	learningTimes: LearningTimeWindow[];
	occupiedEntries?: OccupiedLearningTime[];
}) => {
	const cursor = new Date(`${fromDateKey}T00:00:00.000Z`);
	const examDate = new Date(`${examDateKey}T00:00:00.000Z`);
	if (Number.isNaN(cursor.getTime()) || Number.isNaN(examDate.getTime())) {
		return 0;
	}

	const occupiedIntervalsByDay = getOccupiedIntervalsByDay(occupiedEntries);
	let availableMinutes = 0;
	while (cursor < examDate) {
		const dayKey = cursor.toISOString().slice(0, 10);
		const dayOfWeek = cursor.getUTCDay() || 7;
		for (const learningTime of learningTimes) {
			if (learningTime.dayOfWeek !== dayOfWeek) continue;
			const start = parseTimeToMinutes(learningTime.startTime);
			const end = parseTimeToMinutes(learningTime.endTime);
			if (start === null || end === null || end - start < 10) continue;
			if (
				dayKey === fromDateKey &&
				fromTimeMinutes !== undefined &&
				start <= fromTimeMinutes
			) {
				continue;
			}

			availableMinutes += getFreeWindowMinutes({
				start,
				end,
				occupiedIntervals: occupiedIntervalsByDay.get(dayKey) ?? [],
			});
		}
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return availableMinutes;
};
