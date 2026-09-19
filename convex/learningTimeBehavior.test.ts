import { describe, expect, test } from "vitest";
import { deriveBehavioralLearningTimeSuggestion } from "./learningTimeBehavior";

const completedSession = (
	dateKey: string,
	startedAt: string,
	startTime = "17:00",
) => ({
	dateKey,
	startTime,
	durationMinutes: 60,
	startedAt: new Date(startedAt).getTime(),
	executionStatus: "completed",
	planningStatus: "committed",
});

describe("deriveBehavioralLearningTimeSuggestion", () => {
	const sessions = [
		completedSession("2026-06-01", "2026-06-01T18:00:00.000Z"),
		completedSession("2026-06-02", "2026-06-02T18:10:00.000Z"),
		completedSession("2026-06-08", "2026-06-08T17:50:00.000Z"),
		completedSession("2026-06-09", "2026-06-09T18:00:00.000Z"),
		completedSession("2026-06-15", "2026-06-15T18:05:00.000Z"),
	];

	test("suggests repeated observed days and later times after a stable pattern", () => {
		expect(
			deriveBehavioralLearningTimeSuggestion({
				sessions,
				learningTimes: [
					{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" },
					{ dayOfWeek: 2, startTime: "17:00", endTime: "18:00" },
				],
				grade: "9",
			}),
		).toMatchObject({
			evidenceSessionCount: 5,
			plannedStartTime: "17:00",
			observedStartTime: "20:00",
			entries: [
				{ dayOfWeek: 1, startTime: "20:00", endTime: "21:00" },
				{ dayOfWeek: 2, startTime: "20:00", endTime: "21:00" },
			],
		});
	});

	test("waits for enough completed sessions", () => {
		expect(
			deriveBehavioralLearningTimeSuggestion({
				sessions: sessions.slice(0, 4),
				learningTimes: [{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" }],
				grade: "9",
			}),
		).toBeNull();
	});

	test("does not react to an inconsistent mix of early and late starts", () => {
		const inconsistent = [
			...sessions.slice(0, 3),
			completedSession("2026-06-16", "2026-06-16T13:00:00.000Z"),
			completedSession("2026-06-22", "2026-06-22T13:00:00.000Z"),
		];
		expect(
			deriveBehavioralLearningTimeSuggestion({
				sessions: inconsistent,
				learningTimes: [{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" }],
				grade: "9",
			}),
		).toBeNull();
	});

	test("keeps automatic suggestions inside the grade boundary", () => {
		const lateSessions = [
			completedSession("2026-06-01", "2026-06-01T20:00:00.000Z"),
			completedSession("2026-06-08", "2026-06-08T20:00:00.000Z"),
			completedSession("2026-06-15", "2026-06-15T20:00:00.000Z"),
			completedSession("2026-06-22", "2026-06-22T20:00:00.000Z"),
			completedSession("2026-06-29", "2026-06-29T20:00:00.000Z"),
		];
		expect(
			deriveBehavioralLearningTimeSuggestion({
				sessions: lateSessions,
				learningTimes: [{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" }],
				grade: "8",
			})?.entries,
		).toEqual([{ dayOfWeek: 1, startTime: "19:30", endTime: "20:00" }]);
	});
});
