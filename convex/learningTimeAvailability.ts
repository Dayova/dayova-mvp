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
