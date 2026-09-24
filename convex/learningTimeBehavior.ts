import {
	formatLearningWindowTime,
	getAutomaticLearningWindow,
	parseLearningWindowEnd,
	parseLearningWindowTime,
} from "./learningTimePolicy";

const MIN_ELIGIBLE_SESSIONS = 5;
const MIN_REPEATED_DAY_SESSIONS = 3;
export const BEHAVIOR_OBSERVATION_WINDOW_MS = 28 * 86_400_000;
export const BEHAVIOR_SUGGESTION_SNOOZE_MS = 14 * 86_400_000;
export const isBehavioralSuggestionSnoozed = (
	snoozedAt: number | undefined,
	referenceTime: number,
) =>
	snoozedAt !== undefined &&
	referenceTime - snoozedAt < BEHAVIOR_SUGGESTION_SNOOZE_MS;
const MIN_OBSERVATION_SPAN_MS = 14 * 86_400_000;
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
	preferenceStatus?: string;
};

export type BehavioralLearningTimeSuggestion = {
	fingerprint: string;
	evidenceSessionCount: number;
	plannedStartTime: string;
	observedStartTime: string;
	entries: Array<
		LearningTime & { previousStartTime: string; previousEndTime: string }
	>;
};

type ObservedSession = {
	dayOfWeek: number;
	actualStartMinutes: number;
	plannedStartMinutes: number;
	deviationMinutes: number;
	startedAt: number;
	dateKey: string;
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
	// Moving a session to another day is not evidence for a recurring time shift.
	if (dayDistance !== 0) return null;
	const deviationMinutes =
		dayDistance + actual.startMinutes - plannedStartMinutes;
	if (Math.abs(deviationMinutes) > MAX_ABSOLUTE_SHIFT_MINUTES) return null;
	return {
		dayOfWeek: actual.dayOfWeek,
		startedAt: session.startedAt,
		dateKey: actual.dateKey,
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
	referenceTime,
	observationStartedAt = 0,
}: {
	sessions: BehaviorSession[];
	learningTimes: LearningTime[];
	grade?: string;
	referenceTime: number;
	observationStartedAt?: number;
}): BehavioralLearningTimeSuggestion | null => {
	if (learningTimes.length === 0 || !Number.isFinite(referenceTime))
		return null;
	const observedSessions = sessions
		.filter(
			(session) =>
				session.startedAt !== undefined &&
				session.startedAt <= referenceTime &&
				session.startedAt >= referenceTime - BEHAVIOR_OBSERVATION_WINDOW_MS &&
				session.startedAt > observationStartedAt,
		)
		.map(observeSession)
		.filter((session): session is ObservedSession => session !== null);
	if (observedSessions.length < MIN_ELIGIBLE_SESSIONS) return null;
	const timestamps = observedSessions.map((session) =>
		Date.parse(`${session.dateKey}T00:00:00Z`),
	);
	if (
		Math.max(...timestamps) - Math.min(...timestamps) <
		MIN_OBSERVATION_SPAN_MS
	)
		return null;

	const sessionsByDay = new Map<number, ObservedSession[]>();
	for (const session of observedSessions) {
		const current = sessionsByDay.get(session.dayOfWeek) ?? [];
		current.push(session);
		sessionsByDay.set(session.dayOfWeek, current);
	}
	const repeatedObservedDays = [...sessionsByDay.entries()]
		.filter(([day, daySessions]) => {
			// Multiple windows on one weekday are ambiguous: never replace them all.
			if (learningTimes.filter((time) => time.dayOfWeek === day).length !== 1)
				return false;
			if (
				new Set(daySessions.map((session) => session.dateKey)).size <
				MIN_REPEATED_DAY_SESSIONS
			)
				return false;
			const medianDeviation = median(
				daySessions.map((session) => session.deviationMinutes),
			);
			if (
				medianDeviation === null ||
				Math.abs(medianDeviation) < MIN_MEDIAN_SHIFT_MINUTES
			)
				return false;
			const direction = Math.sign(medianDeviation);
			return (
				daySessions.filter(
					(session) =>
						Math.sign(session.deviationMinutes) === direction &&
						Math.abs(session.deviationMinutes) >= MIN_DIRECTIONAL_SHIFT_MINUTES,
				).length >= Math.ceil(daySessions.length * 0.75)
			);
		})
		.sort(
			([leftDay, leftSessions], [rightDay, rightSessions]) =>
				rightSessions.length - leftSessions.length || leftDay - rightDay,
		)
		.slice(0, MAX_SUGGESTED_DAYS)
		.map(([dayOfWeek]) => dayOfWeek);
	const suggestedDays = repeatedObservedDays;
	if (suggestedDays.length === 0) return null;

	const observedMedian = median(
		observedSessions.map((session) => session.actualStartMinutes),
	);
	const plannedMedian = median(
		observedSessions.map((session) => session.plannedStartMinutes),
	);
	if (observedMedian === null || plannedMedian === null) return null;

	const automaticWindow = getAutomaticLearningWindow(grade);
	const entries = suggestedDays.flatMap((dayOfWeek) => {
		const current = learningTimes.find((time) => time.dayOfWeek === dayOfWeek);
		if (!current) return [];
		const typicalDuration =
			current.preferenceStatus === "systemDefault"
				? 60
				: (getWindowDuration(current) ?? 60);
		if (
			typicalDuration >
			automaticWindow.endMinutes - automaticWindow.startMinutes
		)
			return [];
		const dayMedian = median(
			(sessionsByDay.get(dayOfWeek) ?? []).map(
				(session) => session.actualStartMinutes,
			),
		);
		const startMinutes = Math.min(
			automaticWindow.endMinutes - typicalDuration,
			Math.max(
				automaticWindow.startMinutes,
				roundToHalfHour(dayMedian ?? observedMedian),
			),
		);
		const endMinutes = Math.min(
			automaticWindow.endMinutes,
			startMinutes + typicalDuration,
		);
		return [
			{
				dayOfWeek,
				previousStartTime: current.startTime,
				previousEndTime: current.endTime,
				startTime: formatLearningWindowTime(startMinutes),
				endTime: formatLearningWindowTime(endMinutes),
			},
		];
	});
	const changedEntries = entries.filter(
		(entry) =>
			!learningTimes.some(
				(time) =>
					time.dayOfWeek === entry.dayOfWeek &&
					time.startTime === entry.startTime &&
					time.endTime === entry.endTime,
			),
	);
	if (changedEntries.length === 0) return null;
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
	// Bind consent to the full current schedule, not just the proposed result.
	const fingerprint = `${currentFingerprint}=>${buildFingerprint(changedEntries)}`;

	return {
		fingerprint,
		evidenceSessionCount: observedSessions.length,
		plannedStartTime: formatLearningWindowTime(plannedMedian),
		observedStartTime: formatLearningWindowTime(observedMedian),
		entries: changedEntries,
	};
};
