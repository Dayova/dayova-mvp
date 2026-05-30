const dayKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export const getBerlinDayKey = (value: string) => {
	if (dayKeyPattern.test(value)) return value;

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;

	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "Europe/Berlin",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	if (!year || !month || !day) return null;

	return `${year}-${month}-${day}`;
};

const addIsoVariantsForDateOnlyKey = (
	variants: Set<string>,
	dayKey: string,
) => {
	const match = dayKeyPattern.exec(dayKey);
	if (!match) return;

	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);
	const utcMidnight = Date.UTC(year, monthIndex, day);
	variants.add(new Date(utcMidnight).toISOString());
	variants.add(new Date(utcMidnight - 60 * 60 * 1000).toISOString());
	variants.add(new Date(utcMidnight - 2 * 60 * 60 * 1000).toISOString());
};

export const getDayKeyQueryVariants = (dayKey: string) => {
	const variants = new Set([dayKey]);
	const berlinDayKey = getBerlinDayKey(dayKey);
	if (berlinDayKey) {
		variants.add(berlinDayKey);
		addIsoVariantsForDateOnlyKey(variants, berlinDayKey);
	}

	return [...variants];
};
