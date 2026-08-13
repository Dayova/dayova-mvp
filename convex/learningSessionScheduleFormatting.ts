export const compactLearningSessionTitle = (
	value: string,
	maxChars: number,
) => {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxChars) return normalized;

	const ellipsis = "...";
	const contentMaxChars = maxChars - ellipsis.length;
	const clipped = normalized.slice(0, contentMaxChars).trimEnd();
	const lastSpace = clipped.lastIndexOf(" ");
	const compacted =
		lastSpace >= Math.floor(contentMaxChars * 0.55)
			? clipped.slice(0, lastSpace).trimEnd()
			: clipped;
	return `${compacted}${ellipsis}`;
};

export const formatLearningTimeFromMinutes = (minutes: number) => {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return `${hours.toString().padStart(2, "0")}:${rest
		.toString()
		.padStart(2, "0")}`;
};

export const parseLearningTimeToMinutes = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}

	return hours * 60 + minutes;
};
