import {
	LEARNING_DAYS,
	type LearningDayLabel,
} from "~/features/learning-times/learning-time-days";

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_LEARNING_START_TIME = "16:00";

export const ONBOARDING_DURATION_OPTIONS = [10, 20, 30, 45, 60, 90] as const;

const parseTimeToMinutes = (value: string) => {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
};

const formatTimeFromMinutes = (minutes: number) => {
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
};

export const parseOnboardingDurationMinutes = (value: string) => {
	const normalizedValue = value.trim();
	return (
		ONBOARDING_DURATION_OPTIONS.find(
			(option) => String(option) === normalizedValue,
		) ?? null
	);
};

export const parseOnboardingStudyDays = (value: string) => {
	const selectedLabels = new Set(
		value
			.split(",")
			.map((label) => label.trim())
			.filter(Boolean),
	);
	return LEARNING_DAYS.filter((day) => selectedLabels.has(day.label)).map(
		(day) => day.label,
	);
};

export const toggleOnboardingStudyDay = (
	value: string,
	day: LearningDayLabel,
) => {
	const selectedLabels = new Set(parseOnboardingStudyDays(value));
	if (selectedLabels.has(day)) selectedLabels.delete(day);
	else selectedLabels.add(day);

	return LEARNING_DAYS.filter((option) => selectedLabels.has(option.label))
		.map((option) => option.label)
		.join(", ");
};

export const formatOnboardingTime = (date: Date) =>
	`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const dateForOnboardingTime = (value: string) => {
	const [hours, minutes] = (value.trim() || DEFAULT_LEARNING_START_TIME)
		.split(":")
		.map(Number);
	return new Date(2026, 0, 1, hours || 0, minutes || 0, 0, 0);
};

export const getOnboardingLearningTimeWindow = (input: {
	studyTime: string;
	learningTime: string;
}) => {
	const startMinutes = parseTimeToMinutes(input.learningTime);
	const durationMinutes = parseOnboardingDurationMinutes(input.studyTime);
	if (startMinutes === null || durationMinutes === null) return null;
	const endMinutes = startMinutes + durationMinutes;
	if (endMinutes >= MINUTES_PER_DAY) return null;

	return {
		startTime: formatTimeFromMinutes(startMinutes),
		endTime: formatTimeFromMinutes(endMinutes),
		durationMinutes,
	};
};

export const getOnboardingLearningTimeValidationError = (input: {
	studyTime: string;
	studyDays: string;
	learningTime: string;
}) => {
	if (parseOnboardingDurationMinutes(input.studyTime) === null) {
		return "Bitte wähle deine Lerndauer aus.";
	}
	if (parseOnboardingStudyDays(input.studyDays).length === 0) {
		return "Bitte wähle mindestens einen Lerntag aus.";
	}
	if (!input.learningTime.trim()) {
		return "Bitte wähle eine Uhrzeit aus.";
	}
	if (!getOnboardingLearningTimeWindow(input)) {
		return "Wähle bitte eine frühere Startzeit, damit deine Lernzeit vor Mitternacht endet.";
	}
	return null;
};

const joinGermanList = (values: readonly string[]) => {
	if (values.length <= 1) return values[0] ?? "";
	if (values.length === 2) return `${values[0]} und ${values[1]}`;
	return `${values.slice(0, -1).join(", ")} und ${values.at(-1)}`;
};

export const getOnboardingLearningTimeSummary = (input: {
	studyTime: string;
	studyDays: string;
	learningTime: string;
}) => {
	const days = parseOnboardingStudyDays(input.studyDays);
	const window = getOnboardingLearningTimeWindow(input);
	const durationMinutes =
		window?.durationMinutes ?? parseOnboardingDurationMinutes(input.studyTime);
	return {
		daysLabel: joinGermanList(days),
		durationLabel: durationMinutes === null ? "" : `${durationMinutes} Minuten`,
		windowLabel: window
			? `${window.startTime}–${window.endTime} Uhr`
			: input.learningTime,
	};
};

export const getDefaultOnboardingLearningStartTime = () =>
	DEFAULT_LEARNING_START_TIME;
