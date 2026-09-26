import {
	formatLearningWindowTime,
	getAutomaticLearningWindow,
	parseLearningWindowEnd,
	parseLearningWindowTime,
} from "./learningTimePolicy";

const MIN_ELIGIBLE_SESSIONS = 5;
const MIN_REPEATED_DAY_SESSIONS = 2;
const MIN_DIRECTIONAL_SHIFT_MINUTES = 45;
const MIN_MEDIAN_SHIFT_MINUTES = 60;
const MAX_ABSOLUTE_SHIFT_MINUTES = 12 * 60;
const MAX_SUGGESTED_DAYS = 3;

type BehaviorSession = {
	dateKey: string;
	startTime: string;
	durationMinutes: number;
	startedAt?: number;
	executionStatus?: string;
	planningStatus?: string;
};

type LearningTime = {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

export type BehavioralLearningTimeSuggestion = {
	fingerprint: string;
	evidenceSessionCount: number;
	plannedStartTime: string;
	observedStartTime: string;
	entries: LearningTime[];
};

type ObservedSession = {
	dayOfWeek: number;
	actualStartMinutes: number;
	plannedStartMinutes: number;
	deviationMinutes: number;
};

const median = (values: number[]) => {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
		: sorted[middle];
};

const roundToHalfHour = (minutes: number) => Math.round(minutes / 30) * 30;

const getBerlinStart = (startedAt: number) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Berlin",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(startedAt));
	const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;
	const year = valueFor("year");
	const month = valueFor("month");
	const day = valueFor("day");
	const weekday = valueFor("weekday");
	const hour = Number(valueFor("hour"));
	const minute = Number(valueFor("minute"));
	const dayOfWeekByShortLabel: Record<string, number> = {
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6,
		Sun: 7,
	};
	if (
		!year ||
		!month ||
		!day ||
		!weekday ||
		!Number.isInteger(hour) ||
		!Number.isInteger(minute) ||
		dayOfWeekByShortLabel[weekday] === undefined
	) {
		return null;
	}
	return {
		dateKey: `${year}-${month}-${day}`,
		dayOfWeek: dayOfWeekByShortLabel[weekday],
		startMinutes: hour * 60 + minute,
	};
};

const dateDistanceMinutes = (fromDateKey: string, toDateKey: string) => {
	const from = new Date(`${fromDateKey.slice(0, 10)}T12:00:00.000Z`);
	const to = new Date(`${toDateKey.slice(0, 10)}T12:00:00.000Z`);
	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
	return Math.round((to.getTime() - from.getTime()) / 86_400_000) * 24 * 60;
};

const observeSession = (session: BehaviorSession): ObservedSession | null => {
	if (
		session.startedAt === undefined ||
		session.planningStatus === "provisional" ||
		(session.executionStatus !== "completed" &&
			session.executionStatus !== "partiallyCompleted")
	) {
		return null;
	}
	const plannedStartMinutes = parseLearningWindowTime(session.startTime);
	const actual = getBerlinStart(session.startedAt);
	if (plannedStartMinutes === null || !actual) return null;
	const dayDistance = dateDistanceMinutes(session.dateKey, actual.dateKey);
	if (dayDistance === null) return null;
	const deviationMinutes =
		dayDistance + actual.startMinutes - plannedStartMinutes;
	if (Math.abs(deviationMinutes) > MAX_ABSOLUTE_SHIFT_MINUTES) return null;
	return {
		dayOfWeek: actual.dayOfWeek,
		actualStartMinutes: actual.startMinutes,
		plannedStartMinutes,
		deviationMinutes,
	};
};

const getWindowDuration = (learningTime: LearningTime) => {
	const start = parseLearningWindowTime(learningTime.startTime);
	const end = parseLearningWindowEnd(
		learningTime.startTime,
		learningTime.endTime,
	);
	if (start === null || end === null || end <= start) return null;
	return end - start;
};

const buildFingerprint = (entries: LearningTime[]) =>
	entries
		.map((entry) => `${entry.dayOfWeek}:${entry.startTime}-${entry.endTime}`)
		.join("|");

export const deriveBehavioralLearningTimeSuggestion = ({
	sessions,
	learningTimes,
	grade,
}: {
	sessions: BehaviorSession[];
	learningTimes: LearningTime[];
	grade?: string;
}): BehavioralLearningTimeSuggestion | null => {
	if (learningTimes.length === 0) return null;
	const observedSessions = sessions
		.map(observeSession)
		.filter((session): session is ObservedSession => session !== null);
	if (observedSessions.length < MIN_ELIGIBLE_SESSIONS) return null;

	const medianDeviation = median(
		observedSessions.map((session) => session.deviationMinutes),
	);
	if (
		medianDeviation === null ||
		Math.abs(medianDeviation) < MIN_MEDIAN_SHIFT_MINUTES
	) {
		return null;
	}
	const direction = Math.sign(medianDeviation);
	const directionalSessionCount = observedSessions.filter(
		(session) =>
			Math.sign(session.deviationMinutes) === direction &&
			Math.abs(session.deviationMinutes) >= MIN_DIRECTIONAL_SHIFT_MINUTES,
	).length;
	if (directionalSessionCount < Math.ceil(observedSessions.length * 0.75)) {
		return null;
	}

	const sessionsByDay = new Map<number, ObservedSession[]>();
	for (const session of observedSessions) {
		const current = sessionsByDay.get(session.dayOfWeek) ?? [];
		current.push(session);
		sessionsByDay.set(session.dayOfWeek, current);
	}
	const repeatedObservedDays = [...sessionsByDay.entries()]
		.filter(
			([, daySessions]) => daySessions.length >= MIN_REPEATED_DAY_SESSIONS,
		)
		.sort(
			([leftDay, leftSessions], [rightDay, rightSessions]) =>
				rightSessions.length - leftSessions.length || leftDay - rightDay,
		)
		.slice(0, MAX_SUGGESTED_DAYS)
		.map(([dayOfWeek]) => dayOfWeek);
	const currentDays = [...new Set(learningTimes.map((time) => time.dayOfWeek))]
		.sort((left, right) => left - right)
		.slice(0, MAX_SUGGESTED_DAYS);
	const suggestedDays =
		repeatedObservedDays.length > 0 ? repeatedObservedDays : currentDays;
	if (suggestedDays.length === 0) return null;

	const observedMedian = median(
		observedSessions.map((session) => session.actualStartMinutes),
	);
	const plannedMedian = median(
		observedSessions.map((session) => session.plannedStartMinutes),
	);
	const typicalDuration = Math.max(
		30,
		median(
			learningTimes
				.map(getWindowDuration)
				.filter((duration): duration is number => duration !== null),
		) ?? 60,
	);
	if (observedMedian === null || plannedMedian === null) return null;

	const automaticWindow = getAutomaticLearningWindow(grade);
	const entries = suggestedDays.map((dayOfWeek) => {
		const dayMedian = median(
			(sessionsByDay.get(dayOfWeek) ?? []).map(
				(session) => session.actualStartMinutes,
			),
		);
		const startMinutes = Math.min(
			automaticWindow.endMinutes - 30,
			Math.max(
				automaticWindow.startMinutes,
				roundToHalfHour(dayMedian ?? observedMedian),
			),
		);
		const endMinutes = Math.min(
			automaticWindow.endMinutes,
			startMinutes + typicalDuration,
		);
		return {
			dayOfWeek,
			startTime: formatLearningWindowTime(startMinutes),
			endTime: formatLearningWindowTime(endMinutes),
		};
	});
	const currentFingerprint = buildFingerprint(
		learningTimes
			.map(({ dayOfWeek, startTime, endTime }) => ({
				dayOfWeek,
				startTime,
				endTime,
			}))
			.sort(
				(left, right) =>
					left.dayOfWeek - right.dayOfWeek ||
					left.startTime.localeCompare(right.startTime),
			),
	);
	const fingerprint = buildFingerprint(entries);
	if (!fingerprint || fingerprint === currentFingerprint) return null;

	return {
		fingerprint,
		evidenceSessionCount: observedSessions.length,
		plannedStartTime: formatLearningWindowTime(plannedMedian),
		observedStartTime: formatLearningWindowTime(observedMedian),
		entries,
	};
};
