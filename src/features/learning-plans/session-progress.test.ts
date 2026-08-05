import { describe, expect, it } from "vitest";
import {
	CONTINUE_LEARNING_MINUTES,
	getLearningSessionCompletionPhase,
	getLearningSessionItems,
	getLearningSessionTimerDurationSeconds,
	getTheoryTopicPosition,
	isQualifiedSessionCompletion,
	isTheoryKnowledgeCheckItem,
} from "./session-progress";

const learnCard = { id: "theory", kind: "learnCard", phase: "theory" } as const;
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

	it("puts the knowledge check before theory in a split session", () => {
		expect(
			getLearningSessionItems([learnCard, practiceTask], "theory", "split"),
		).toEqual([practiceTask, learnCard]);
		expect(getLearningSessionCompletionPhase("theory", "split")).toBe(
			"practice",
		);
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

		expect(getTheoryTopicPosition(items, 1)).toEqual({
			topicIndex: 0,
			total: 2,
			previousSessionIndex: null,
			nextSessionIndex: 2,
		});
		expect(getTheoryTopicPosition(items, 2)).toEqual({
			topicIndex: 1,
			total: 2,
			previousSessionIndex: 1,
			nextSessionIndex: null,
		});
	});

	it("keeps optional follow-up practice after the theory cards", () => {
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
		).toEqual([practiceTask, learnCard, followUpTask]);
	});

	it("identifies only the pre-theory validation item as a knowledge check", () => {
		expect(
			isTheoryKnowledgeCheckItem({
				item: practiceTask,
				phase: "theory",
				compositionVariant: "split",
			}),
		).toBe(true);
		expect(
			isTheoryKnowledgeCheckItem({
				item: practiceTask,
				phase: "practice",
				compositionVariant: "split",
			}),
		).toBe(false);
		expect(
			isTheoryKnowledgeCheckItem({
				item: {
					...practiceTask,
					coverageKey: "topic:apply:1",
				},
				phase: "theory",
				compositionVariant: "split",
			}),
		).toBe(false);
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
