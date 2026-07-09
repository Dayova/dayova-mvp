const normalizeDateLabel = (dateLabel?: string) => {
	const trimmed = dateLabel?.trim();
	if (!trimmed) return "";

	return trimmed.replace(/\s+\d{4}$/, "").replace(/^(\d{1,2})\.\s/u, "$1 ");
};

const parseCalendarDateKey = (dateKey?: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey ?? "");
	if (!match) return null;

	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);
	const parsed = new Date(year, monthIndex, day);

	return parsed.getFullYear() === year &&
		parsed.getMonth() === monthIndex &&
		parsed.getDate() === day
		? parsed
		: null;
};

const formatDateFromKey = (dateKey?: string) => {
	const parsed = parseCalendarDateKey(dateKey);
	if (!parsed) return "";

	return new Intl.DateTimeFormat("de-DE", {
		day: "numeric",
		month: "long",
	})
		.format(parsed)
		.replace(/^(\d{1,2})\.\s/u, "$1 ");
};

export const buildDateTimeLabel = ({
	dateKey,
	dateLabel,
	time,
}: {
	dateKey?: string;
	dateLabel?: string;
	time?: string;
}) => {
	const resolvedDateLabel =
		normalizeDateLabel(dateLabel) || formatDateFromKey(dateKey);
	const timeLabel = time?.trim();

	return [resolvedDateLabel, timeLabel].filter(Boolean).join(", ");
};
