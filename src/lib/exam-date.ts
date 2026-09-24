import { addDays, startOfLocalDay } from "./day-key";

const DEFAULT_EXAM_DATE_FUTURE_DAYS = 365;

const germanAccessibleDateFormatter = new Intl.DateTimeFormat("de-DE", {
	day: "numeric",
	month: "long",
	year: "numeric",
});

function getExamDatePickerRange({
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
	return { minimumDate: rangeStart, maximumDate: rangeEnd };
}

function formatAccessibleExamDate(date: Date) {
	return germanAccessibleDateFormatter.format(date);
}

export { getExamDatePickerRange, formatAccessibleExamDate };
