import { describe, expect, it } from "vitest";
import { learningSessionAnalyticsProperties } from "./session-analytics";

const sessionResult = {
	learningPlanId: "plan-1",
	learningPlanSessionId: "session-1",
	phase: "practice" as const,
	plannedDayKey: "2026-06-04",
	startTime: "16:00",
	durationMinutes: 30,
};

describe("learningSessionAnalyticsProperties", () => {
	it("normalizes stored ISO dates to analytics day keys", () => {
		expect(
			learningSessionAnalyticsProperties({
				...sessionResult,
				plannedDayKey: "2026-06-04T00:00:00.000Z",
				examDateKey: "2026-06-12T00:00:00.000Z",
			}),
		).toMatchObject({
			planned_day_key: "2026-06-04",
			deadline_day_key: "2026-06-12",
		});
	});

	it("preserves canonical day keys and omits an absent deadline", () => {
		expect(learningSessionAnalyticsProperties(sessionResult)).toEqual({
			learning_plan_id: "plan-1",
			learning_plan_session_id: "session-1",
			phase: "practice",
			planned_day_key: "2026-06-04",
			planned_start_time: "16:00",
			duration_minutes: 30,
		});
	});
});
