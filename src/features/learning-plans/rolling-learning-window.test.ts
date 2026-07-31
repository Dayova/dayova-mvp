import { describe, expect, test } from "vitest";
import {
	getCommittedSessionIndex,
	getDefaultLearningPlanSession,
	isLearningPlanSessionHistory,
} from "~/features/learning-plans/rolling-learning-window";
import type { PlanSession } from "~/features/learning-plans/types";

const session = (
	id: string,
	overrides: Partial<PlanSession> = {},
): PlanSession => ({
	id: id as PlanSession["id"],
	phase: "practice",
	title: id,
	dateKey: "2026-06-01",
	dateLabel: "1. Juni 2026",
	startTime: "17:00",
	durationMinutes: 15,
	goal: "Üben",
	tasks: ["Aufgabe lösen"],
	expectedOutcome: "Aufgabe gelöst",
	sortOrder: 0,
	completed: false,
	executionStatus: "notStarted",
	...overrides,
});

describe("rolling learning window", () => {
	test("selects the committed session instead of its provisional preview", () => {
		const sessions = [
			session("history", {
				completed: true,
				executionStatus: "completed",
				planningStatus: "committed",
			}),
			session("committed", { planningStatus: "committed" }),
			session("preview", { planningStatus: "provisional" }),
		];

		expect(getCommittedSessionIndex(sessions)).toBe(1);
		expect(getDefaultLearningPlanSession(sessions)?.id).toBe("committed");
	});

	test("treats partial and missed outcomes as history", () => {
		expect(
			isLearningPlanSessionHistory(
				session("partial", { executionStatus: "partiallyCompleted" }),
			),
		).toBe(true);
		expect(
			isLearningPlanSessionHistory(
				session("missed", { executionStatus: "missed" }),
			),
		).toBe(true);
	});
});
