export const ONBOARDING_DURATION_MINUTES = [
	10, 20, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
] as const;

const DAY_OF_WEEK_BY_LABEL = {
	Montag: 1,
	Dienstag: 2,
	Mittwoch: 3,
	Donnerstag: 4,
	Freitag: 5,
	Samstag: 6,
	Sonntag: 7,
} as const;

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const durationPattern = /^(\d{1,3})\s*min$/i;
const MINUTES_PER_DAY = 24 * 60;

export type OnboardingLearningTimeInput = {
	studyDays: string;
	learningTime: string;
	dailySchoolTime: string;
};

export type DerivedLearningTime = {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

const PROPOSED_WINDOW_MINUTES = 30;
const PROPOSED_START_MINUTES = 17 * 60;
const MAX_PROPOSED_DAYS = 3;

const parseDateKey = (value: string) => {
	const date = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
	return Number.isNaN(date.getTime()) ? null : date;
};

const getDayOfWeek = (date: Date) => date.getUTCDay() || 7;

const roundUpToTenMinutes = (minutes: number) => Math.ceil(minutes / 10) * 10;

export const deriveProposedLearningTimes = ({
	currentDateKey,
	currentTimeMinutes,
	examDateKey,
}: {
	currentDateKey: string;
	currentTimeMinutes: number;
	examDateKey: string;
}): DerivedLearningTime[] => {
	const currentDate = parseDateKey(currentDateKey);
	const examDate = parseDateKey(examDateKey);
	if (!currentDate || !examDate || examDate < currentDate) return [];

	const lastPlanningDate = new Date(examDate);
	if (examDate > currentDate) {
		lastPlanningDate.setUTCDate(lastPlanningDate.getUTCDate() - 1);
	}

	const proposed: DerivedLearningTime[] = [];
	const usedDays = new Set<number>();
	const cursor = new Date(currentDate);
	while (cursor <= lastPlanningDate && proposed.length < MAX_PROPOSED_DAYS) {
		const dayOfWeek = getDayOfWeek(cursor);
		if (!usedDays.has(dayOfWeek)) {
			const isToday = cursor.getTime() === currentDate.getTime();
			const startMinutes = isToday
				? Math.max(
						PROPOSED_START_MINUTES,
						roundUpToTenMinutes(currentTimeMinutes + 10),
					)
				: PROPOSED_START_MINUTES;
			if (startMinutes + PROPOSED_WINDOW_MINUTES < 24 * 60) {
				proposed.push({
					dayOfWeek,
					startTime: formatTime(startMinutes),
					endTime: formatTime(startMinutes + PROPOSED_WINDOW_MINUTES),
				});
				usedDays.add(dayOfWeek);
			}
		}
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return proposed;
};

export type OnboardingLearningTimeError =
	| "missingDays"
	| "invalidDay"
	| "invalidTime"
	| "invalidDuration"
	| "crossesMidnight";

export type OnboardingLearningTimeResult =
	| { ok: true; windows: DerivedLearningTime[] }
	| { ok: false; reason: OnboardingLearningTimeError };

const parseTimeToMinutes = (value: string) => {
	const match = timePattern.exec(value.trim());
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
};

const parseDurationMinutes = (value: string) => {
	const match = durationPattern.exec(value.trim());
	if (!match) return null;
	const minutes = Number(match[1]);
	return ONBOARDING_DURATION_MINUTES.some((option) => option === minutes)
		? minutes
		: null;
};

const formatTime = (minutes: number) => {
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
};

export const deriveOnboardingLearningTimes = (
	input: OnboardingLearningTimeInput,
): OnboardingLearningTimeResult => {
	const dayLabels = input.studyDays
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (dayLabels.length === 0) return { ok: false, reason: "missingDays" };

	const dayValues = new Set<number>();
	for (const label of dayLabels) {
		const dayOfWeek =
			DAY_OF_WEEK_BY_LABEL[label as keyof typeof DAY_OF_WEEK_BY_LABEL];
		if (dayOfWeek === undefined) return { ok: false, reason: "invalidDay" };
		dayValues.add(dayOfWeek);
	}

	const startMinutes = parseTimeToMinutes(input.learningTime);
	if (startMinutes === null) return { ok: false, reason: "invalidTime" };

	const durationMinutes = parseDurationMinutes(input.dailySchoolTime);
	if (durationMinutes === null) {
		return { ok: false, reason: "invalidDuration" };
	}

	const endMinutes = startMinutes + durationMinutes;
	if (endMinutes >= MINUTES_PER_DAY) {
		return { ok: false, reason: "crossesMidnight" };
	}

	const startTime = formatTime(startMinutes);
	const endTime = formatTime(endMinutes);
	return {
		ok: true,
		windows: [...dayValues]
			.sort((left, right) => left - right)
			.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime })),
	};
};

export const getOnboardingLearningTimeErrorMessage = (
	reason: OnboardingLearningTimeError,
) => {
	switch (reason) {
		case "missingDays":
			return "Bitte wähle mindestens einen Lerntag aus.";
		case "invalidDay":
			return "Bitte wähle gültige Lerntage aus.";
		case "invalidTime":
			return "Bitte wähle eine gültige Lernzeit aus.";
		case "invalidDuration":
			return "Bitte wähle eine gültige tägliche Lernzeit aus.";
		case "crossesMidnight":
			return "Wähle bitte eine frühere Lernzeit oder eine kürzere tägliche Lernzeit, damit deine Lernzeit vor Mitternacht endet.";
	}
};
