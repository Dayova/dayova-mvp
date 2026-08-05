import { describe, expect, it } from "vitest";
import {
	CONTINUE_LEARNING_MINUTES,
	getLearningSessionCompletionPhase,
	getLearningSessionItems,
	getLearningSessionTimerDurationSeconds,
	getPairedTheoryItem,
	getTheoryTopicPosition,
	isQualifiedSessionCompletion,
} from "./session-progress";

const learnCard = {
	id: "theory",
	kind: "learnCard",
	phase: "theory",
	coverageKey: "topic:recall:0",
} as const;
const practiceTask = {
	id: "practice",
	kind: "written",
	phase: "practice",
	coverageKey: "topic:apply:validation:0",
} as const;

describe("learning session progress", () => {
	it("keeps a control theory session focused on learning cards", () => {
		expect(
			getLearningSessionItems([learnCard, practiceTask], "theory", "control"),
		).toEqual([learnCard]);
	});

	it("omits a detached knowledge check from a split theory session", () => {
		expect(
			getLearningSessionItems([learnCard, practiceTask], "theory", "split"),
		).toEqual([learnCard]);
		expect(getLearningSessionCompletionPhase("theory", "split")).toBe("theory");
	});

	it("maps reordered theory cards to their local topic position", () => {
		const secondLearnCard = {
			id: "theory-2",
			kind: "learnCard",
			phase: "theory",
		} as const;
		const items = getLearningSessionItems(
			[learnCard, secondLearnCard, practiceTask],
			"theory",
			"split",
		);

		expect(getTheoryTopicPosition(items, 0)).toEqual({
			topicIndex: 0,
			total: 2,
			previousSessionIndex: null,
			nextSessionIndex: 1,
		});
		expect(getTheoryTopicPosition(items, 1)).toEqual({
			topicIndex: 1,
			total: 2,
			previousSessionIndex: 0,
			nextSessionIndex: null,
		});
	});

	it("places each prediction question directly before its theory page", () => {
		const secondLearnCard = {
			id: "theory-2",
			kind: "learnCard",
			phase: "theory",
			coverageKey: "topic:apply:0",
		} as const;
		const firstPractice = {
			id: "practice-1",
			kind: "written",
			phase: "practice",
			coverageKey: "topic:recall:0:paired-practice",
		} as const;
		const secondPractice = {
			id: "practice-2",
			kind: "written",
			phase: "practice",
			coverageKey: "topic:apply:0:paired-practice",
		} as const;

		expect(
			getLearningSessionItems(
				[
					learnCard,
					secondLearnCard,
					practiceTask,
					firstPractice,
					secondPractice,
				],
				"theory",
				"split",
			),
		).toEqual([firstPractice, learnCard, secondPractice, secondLearnCard]);
	});

	it("maps a paired question to the same topic as its theory page", () => {
		const pairedQuestion = {
			id: "prediction",
			kind: "written",
			phase: "practice",
			coverageKey: "topic:recall:0:paired-practice",
		} as const;
		const items = [practiceTask, pairedQuestion, learnCard];

		expect(getPairedTheoryItem(items, 1)).toBe(learnCard);
		expect(getTheoryTopicPosition(items, 1)).toEqual({
			topicIndex: 0,
			total: 1,
			previousSessionIndex: null,
			nextSessionIndex: null,
		});
	});

	it("keeps unrelated practice outside the theory flow", () => {
		const followUpTask = {
			id: "follow-up",
			kind: "written",
			phase: "practice",
			coverageKey: "topic:apply:1",
		} as const;

		expect(
			getLearningSessionItems(
				[learnCard, practiceTask, followUpTask],
				"theory",
				"split",
			),
		).toEqual([learnCard]);
	});

	it("qualifies a 30-minute completion after 24 active minutes", () => {
		expect(isQualifiedSessionCompletion(30, 24 * 60)).toBe(true);
		expect(isQualifiedSessionCompletion(30, 24 * 60 - 1)).toBe(false);
	});

	it("offers a repeatable ten-minute continuation", () => {
		expect(CONTINUE_LEARNING_MINUTES).toBe(10);
	});

	it("only times a loaded exam-test session", () => {
		expect(
			getLearningSessionTimerDurationSeconds({
				phase: "theory",
				durationMinutes: 10,
				hasCurrentItem: true,
				isContinuation: false,
			}),
		).toBeNull();
		expect(
			getLearningSessionTimerDurationSeconds({
				phase: "practice",
				durationMinutes: 20,
				hasCurrentItem: true,
				isContinuation: false,
			}),
		).toBeNull();
		expect(
			getLearningSessionTimerDurationSeconds({
				phase: "rehearsal",
				durationMinutes: 10,
				hasCurrentItem: false,
				isContinuation: false,
			}),
		).toBeNull();
		expect(
			getLearningSessionTimerDurationSeconds({
				phase: "rehearsal",
				durationMinutes: 10,
				hasCurrentItem: true,
				isContinuation: true,
			}),
		).toBeNull();
		expect(
			getLearningSessionTimerDurationSeconds({
				phase: "rehearsal",
				durationMinutes: 10,
				hasCurrentItem: true,
				isContinuation: false,
			}),
		).toBe(10 * 60);
	});
});
