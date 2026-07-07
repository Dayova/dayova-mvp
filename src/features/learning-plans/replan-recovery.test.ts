import { describe, expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import {
	buildPlanGenerationAnswers,
	LEARNING_TIME_REPLAN_PARAM,
	shouldReplanAfterLearningTimes,
} from "./replan-recovery";

const snapshot = (
	overrides: Partial<LearningPlanSnapshot> = {},
): LearningPlanSnapshot => ({
	plan: {
		id: "plan-id" as Id<"learningPlans">,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-06-05",
		examDateLabel: "5. Juni 2026",
		examTime: "09:00",
		durationMinutes: 90,
		topicDescription: "Lineare Funktionen",
		status: "generated",
		knowledgeQuestions: [
			{ id: "q1", prompt: "Frage 1", targetInsight: "Wissensstand" },
			{ id: "q2", prompt: "Frage 2", targetInsight: "Lücke" },
		],
	},
	documents: [],
	answers: [
		{
			id: "answer-1" as Id<"learningPlanAnswers">,
			questionId: "q1",
			answer: "Ableitungen",
		},
		{
			id: "answer-2" as Id<"learningPlanAnswers">,
			questionId: "q2",
			answer: "Nullstellen",
		},
	],
	sessions: [],
	...overrides,
});

describe("learning time replan recovery", () => {
	test("builds the stored answers expected by plan generation", () => {
		expect(buildPlanGenerationAnswers(snapshot())).toEqual([
			{ questionId: "q1", answer: "Ableitungen" },
			{ questionId: "q2", answer: "Nullstellen" },
		]);
	});

	test("replans only for empty generated plans returning from learning times", () => {
		expect(
			shouldReplanAfterLearningTimes(snapshot(), LEARNING_TIME_REPLAN_PARAM),
		).toBe(true);

		expect(shouldReplanAfterLearningTimes(snapshot(), undefined)).toBe(false);
		expect(
			shouldReplanAfterLearningTimes(
				snapshot({
					sessions: [
						{
							id: "session-id" as Id<"learningPlanSessions">,
							phase: "practice",
							title: "Üben",
							dateKey: "2026-06-04",
							dateLabel: "4. Juni 2026",
							startTime: "17:00",
							durationMinutes: 30,
							goal: "Üben",
							tasks: ["Aufgaben lösen"],
							expectedOutcome: "Vorbereitet",
							sortOrder: 0,
							completed: false,
						},
					],
				}),
				LEARNING_TIME_REPLAN_PARAM,
			),
		).toBe(false);
	});

	test("does not replan when stored quiz answers are incomplete", () => {
		expect(
			shouldReplanAfterLearningTimes(
				snapshot({
					answers: [
						{
							id: "answer-1" as Id<"learningPlanAnswers">,
							questionId: "q1",
							answer: "Ableitungen",
						},
					],
				}),
				LEARNING_TIME_REPLAN_PARAM,
			),
		).toBe(false);
	});

	test("does not replan until the missing learning-times hint has cleared", () => {
		expect(
			shouldReplanAfterLearningTimes(
				snapshot({
					plan: {
						...snapshot().plan,
						planningHint: "Keine Lernzeiten hinterlegt. 0/60 Min. geplant.",
					},
				}),
				LEARNING_TIME_REPLAN_PARAM,
			),
		).toBe(false);
	});
});
