export type AutomaticLearningWindow = {
	startMinutes: number;
	endMinutes: number;
	startTime: string;
	endTime: string;
	gradeBand: "grades5To8" | "grades9To10" | "grade11Plus" | "fallback";
};

const AUTOMATIC_START_MINUTES = 16 * 60;

const parseGrade = (grade?: string) => {
	if (!grade) return null;
	const value = Number.parseInt(grade.trim(), 10);
	return Number.isInteger(value) ? value : null;
};

export const formatLearningWindowTime = (minutes: number) => {
	const normalizedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
	const hours = Math.floor(normalizedMinutes / 60);
	const remainingMinutes = normalizedMinutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
};

export const getAutomaticLearningWindow = (
	grade?: string,
): AutomaticLearningWindow => {
	const parsedGrade = parseGrade(grade);
	const endMinutes =
		parsedGrade !== null && parsedGrade >= 11
			? 24 * 60
			: parsedGrade !== null && parsedGrade >= 9
				? 22 * 60
				: 20 * 60;
	const gradeBand =
		parsedGrade === null
			? ("fallback" as const)
			: parsedGrade >= 11
				? ("grade11Plus" as const)
				: parsedGrade >= 9
					? ("grades9To10" as const)
					: ("grades5To8" as const);

	return {
		startMinutes: AUTOMATIC_START_MINUTES,
		endMinutes,
		startTime: formatLearningWindowTime(AUTOMATIC_START_MINUTES),
		endTime: formatLearningWindowTime(endMinutes),
		gradeBand,
	};
};

export const parseLearningWindowTime = (value: string) => {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
};

export const parseLearningWindowEnd = (startTime: string, endTime: string) => {
	const startMinutes = parseLearningWindowTime(startTime);
	const parsedEndMinutes = parseLearningWindowTime(endTime);
	if (startMinutes === null || parsedEndMinutes === null) return null;
	return parsedEndMinutes === 0 && startMinutes > 0
		? 24 * 60
		: parsedEndMinutes;
};
