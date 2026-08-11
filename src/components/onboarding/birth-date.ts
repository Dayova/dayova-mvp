export const BIRTH_MONTH_OPTIONS = [
	{ value: "01", label: "Januar" },
	{ value: "02", label: "Februar" },
	{ value: "03", label: "März" },
	{ value: "04", label: "April" },
	{ value: "05", label: "Mai" },
	{ value: "06", label: "Juni" },
	{ value: "07", label: "Juli" },
	{ value: "08", label: "August" },
	{ value: "09", label: "September" },
	{ value: "10", label: "Oktober" },
	{ value: "11", label: "November" },
	{ value: "12", label: "Dezember" },
] as const;

export const BIRTH_MONTH_VALUES = BIRTH_MONTH_OPTIONS.map(
	(option) => option.value,
);

export function getBirthYearValues(currentYear = new Date().getFullYear()) {
	return Array.from({ length: 121 }, (_, index) => String(currentYear - index));
}

export function getBirthMonthValues(year: string, today = new Date()) {
	const parsedYear = Number.parseInt(year, 10);
	if (!Number.isInteger(parsedYear) || parsedYear > today.getFullYear())
		return [];
	if (parsedYear < today.getFullYear()) return BIRTH_MONTH_VALUES;
	return BIRTH_MONTH_VALUES.slice(0, today.getMonth() + 1);
}

export function getBirthDayValues(
	year: string,
	month: string,
	today = new Date(),
) {
	const parsedYear = Number.parseInt(year, 10);
	const parsedMonth = Number.parseInt(month, 10);
	if (
		!Number.isInteger(parsedYear) ||
		parsedYear > today.getFullYear() ||
		parsedMonth < 1 ||
		parsedMonth > 12
	) {
		return [];
	}

	const monthIsCurrent =
		parsedYear === today.getFullYear() && parsedMonth === today.getMonth() + 1;
	const dayCount = monthIsCurrent
		? today.getDate()
		: new Date(parsedYear, parsedMonth, 0).getDate();
	return Array.from({ length: dayCount }, (_, index) =>
		String(index + 1).padStart(2, "0"),
	);
}

export function formatOnboardingBirthDate(input: {
	year: string;
	month: string;
	day: string;
}) {
	const validDays = getBirthDayValues(input.year, input.month);
	if (!validDays.includes(input.day)) return "";
	return `${input.day}.${input.month}.${input.year}`;
}
