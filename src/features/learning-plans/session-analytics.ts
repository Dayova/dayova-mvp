import type { SessionPhase } from "./types";

const DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:T|$)/;

const normalizeAnalyticsDayKey = (value: string) =>
	DATE_PREFIX_PATTERN.exec(value)?.[1] ?? value;

export const learningSessionAnalyticsProperties = (result: {
	learningPlanId: string;
	learningPlanSessionId: string;
	phase: SessionPhase;
	plannedDayKey: string;
	startTime: string;
	durationMinutes: number;
	examDateKey?: string;
}) => ({
	learning_plan_id: result.learningPlanId,
	learning_plan_session_id: result.learningPlanSessionId,
	phase: result.phase,
	planned_day_key: normalizeAnalyticsDayKey(result.plannedDayKey),
	planned_start_time: result.startTime,
	duration_minutes: result.durationMinutes,
	...(result.examDateKey
		? { deadline_day_key: normalizeAnalyticsDayKey(result.examDateKey) }
		: {}),
});
