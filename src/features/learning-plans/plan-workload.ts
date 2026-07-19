const MIN_TOTAL_STUDY_MINUTES = 30;
const MAX_TOTAL_STUDY_MINUTES = 180;

const roundToTen = (minutes: number) => Math.round(minutes / 10) * 10;

const parseTimeToMinutes = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
	return (hours ?? 0) * 60 + (minutes ?? 0);
};

export const calculateAvailableStudyMinutes = ({
	fromDateKey,
	examDateKey,
	learningTimes,
}: {
	fromDateKey: string;
	examDateKey: string;
	learningTimes: Array<{
		dayOfWeek: number;
		startTime: string;
		endTime: string;
	}>;
}) => {
	const cursor = new Date(`${fromDateKey}T00:00:00.000Z`);
	const examDate = new Date(`${examDateKey}T00:00:00.000Z`);
	if (Number.isNaN(cursor.getTime()) || Number.isNaN(examDate.getTime()))
		return 0;

	let availableMinutes = 0;
	while (cursor < examDate) {
		const dayOfWeek = cursor.getUTCDay() || 7;
		for (const learningTime of learningTimes) {
			if (learningTime.dayOfWeek !== dayOfWeek) continue;
			const start = parseTimeToMinutes(learningTime.startTime);
			const end = parseTimeToMinutes(learningTime.endTime);
			if (start === null || end === null || end - start < 10) continue;
			availableMinutes += Math.min(30, end - start);
		}
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return availableMinutes;
};

const isUncertainAnswer = (answer: string) => {
	const normalized = answer.trim().toLocaleLowerCase("de-DE");
	return (
		normalized.length <= 10 ||
		normalized.includes("weiß ich nicht") ||
		normalized.includes("weiss ich nicht") ||
		normalized.includes("keine ahnung") ||
		normalized.includes("unsicher")
	);
};

export const suggestTotalStudyMinutes = ({
	examDurationMinutes,
	answers,
	availableMinutes,
}: {
	examDurationMinutes: number;
	answers: string[];
	availableMinutes?: number | null;
}) => {
	const examBasedMinutes = Math.max(
		MIN_TOTAL_STUDY_MINUTES,
		roundToTen((Math.max(examDurationMinutes, 30) * 2) / 3),
	);
	const uncertaintyMinutes = Math.min(
		30,
		answers.filter(isUncertainAnswer).length * 10,
	);
	const suggestedMinutes = Math.min(
		MAX_TOTAL_STUDY_MINUTES,
		examBasedMinutes + uncertaintyMinutes,
	);

	if (availableMinutes === undefined || availableMinutes === null) {
		return suggestedMinutes;
	}
	if (availableMinutes < 10) return suggestedMinutes;
	return Math.min(suggestedMinutes, Math.floor(availableMinutes / 5) * 5);
};
