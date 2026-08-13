import { addDays, getDayKey, startOfLocalDay } from "./day-key";

const DEFAULT_EXAM_DATE_FUTURE_DAYS = 365;

const germanMonthFormatter = new Intl.DateTimeFormat("de-DE", {
	month: "long",
});

const germanAccessibleDateFormatter = new Intl.DateTimeFormat("de-DE", {
	day: "numeric",
	month: "long",
	year: "numeric",
});

function buildExamDateOptions({
	selectedDate,
	today = new Date(),
	futureDays = DEFAULT_EXAM_DATE_FUTURE_DAYS,
}: {
	selectedDate: Date;
	today?: Date;
	futureDays?: number;
}) {
	const localToday = startOfLocalDay(today);
	const localSelectedDate = startOfLocalDay(selectedDate);
	const defaultRangeEnd = addDays(localToday, Math.max(futureDays, 0));
	const rangeStart =
		localSelectedDate.getTime() < localToday.getTime()
			? localSelectedDate
			: localToday;
	const rangeEnd =
		localSelectedDate.getTime() > defaultRangeEnd.getTime()
			? localSelectedDate
			: defaultRangeEnd;
	const options: Date[] = [];

	for (
		let date = rangeStart;
		date.getTime() <= rangeEnd.getTime();
		date = addDays(date, 1)
	) {
		options.push(date);
	}

	return options;
}

function findExamDateIndex(options: readonly Date[], selectedDate: Date) {
	const selectedDayKey = getDayKey(selectedDate);
	const index = options.findIndex((date) => getDayKey(date) === selectedDayKey);
	return index < 0 ? 0 : index;
}

function formatExamDateDay(date: Date) {
	return `${date.getDate()}`;
}

function formatExamDateMonth(date: Date) {
	return germanMonthFormatter.format(date);
}

function formatAccessibleExamDate(date: Date) {
	return germanAccessibleDateFormatter.format(date);
}

export {
	buildExamDateOptions,
	findExamDateIndex,
	formatAccessibleExamDate,
	formatExamDateDay,
	formatExamDateMonth,
};
