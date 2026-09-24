import { describe, expect, test } from "vitest";
import {
	BEHAVIOR_SUGGESTION_SNOOZE_MS,
	deriveBehavioralLearningTimeSuggestion,
	isBehavioralSuggestionSnoozed,
} from "./learningTimeBehavior";

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
	const derive = (
		overrides: Partial<
			Parameters<typeof deriveBehavioralLearningTimeSuggestion>[0]
		> = {},
	) =>
		deriveBehavioralLearningTimeSuggestion({
			sessions,
			learningTimes: [{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" }],
			grade: "9",
			referenceTime: Date.parse("2026-06-16T12:00:00Z"),
			...overrides,
		});
	test("ignores stale, future and pre-consent observations", () => {
		expect(
			derive({ referenceTime: Date.parse("2026-08-01T12:00:00Z") }),
		).toBeNull();
		expect(
			derive({ referenceTime: Date.parse("2026-05-31T12:00:00Z") }),
		).toBeNull();
		expect(
			derive({ observationStartedAt: Date.parse("2026-06-10T12:00:00Z") }),
		).toBeNull();
	});
	test("does not infer a routine from a burst of sessions or missed sessions", () => {
		expect(derive({ sessions: Array(5).fill(sessions[0]) })).toBeNull();
		expect(
			derive({
				sessions: sessions.map((session) => ({
					...session,
					executionStatus: "missed",
				})),
			}),
		).toBeNull();
	});
	test("does not replace ambiguous same-day windows or invent weekdays", () => {
		expect(
			derive({
				learningTimes: [
					{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" },
					{ dayOfWeek: 1, startTime: "19:00", endTime: "20:00" },
				],
			}),
		).toBeNull();
		expect(
			derive({
				learningTimes: [{ dayOfWeek: 5, startTime: "17:00", endTime: "18:00" }],
			}),
		).toBeNull();
	});
	test("binds consent to the original schedule including unaffected days", () => {
		expect(derive()?.fingerprint).not.toBe(
			derive({
				learningTimes: [
					{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" },
					{ dayOfWeek: 5, startTime: "17:00", endTime: "18:00" },
				],
			})?.fingerprint,
		);
	});
	test("snoozes globally for exactly fourteen days", () => {
		expect(
			isBehavioralSuggestionSnoozed(
				100,
				100 + BEHAVIOR_SUGGESTION_SNOOZE_MS - 1,
			),
		).toBe(true);
		expect(
			isBehavioralSuggestionSnoozed(100, 100 + BEHAVIOR_SUGGESTION_SNOOZE_MS),
		).toBe(false);
		expect(isBehavioralSuggestionSnoozed(undefined, 100)).toBe(false);
	});

	test("suggests repeated observed days and later times after a stable pattern", () => {
		expect(
			deriveBehavioralLearningTimeSuggestion({
				sessions,
				learningTimes: [
					{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" },
					{ dayOfWeek: 2, startTime: "17:00", endTime: "18:00" },
				],
				grade: "9",
				referenceTime: Date.parse("2026-06-23T00:00:00Z"),
			}),
		).toMatchObject({
			evidenceSessionCount: 5,
			plannedStartTime: "17:00",
			observedStartTime: "20:00",
			entries: [{ dayOfWeek: 1, startTime: "20:00", endTime: "21:00" }],
		});
	});

	test("waits for enough completed sessions", () => {
		expect(
			deriveBehavioralLearningTimeSuggestion({
				sessions: sessions.slice(0, 4),
				learningTimes: [{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" }],
				grade: "9",
				referenceTime: Date.parse("2026-06-23T00:00:00Z"),
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
				referenceTime: Date.parse("2026-06-23T00:00:00Z"),
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
				referenceTime: Date.parse("2026-06-29T20:00:00Z"),
			})?.entries,
		).toMatchObject([{ dayOfWeek: 1, startTime: "19:00", endTime: "20:00" }]);
	});
});
