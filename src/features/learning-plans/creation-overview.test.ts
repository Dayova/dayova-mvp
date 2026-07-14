import { describe, expect, test } from "vitest";
import { getLearningPlanOverviewState } from "./creation-overview";

describe("learning plan creation overview", () => {
	test("presents exact creation progress and resumes at the first unanswered question", () => {
		expect(
			getLearningPlanOverviewState({
				status: "questionsReady",
				questionCount: 5,
				answeredQuestionCount: 2,
				firstUnansweredQuestionIndex: 2,
			}),
		).toEqual({
			kind: "creation",
			badgeLabel: "Noch nicht erstellt",
			actionLabel: "Lernplan-Erstellung fortsetzen",
			progressLabel: "2 von 5 Fragen beantwortet",
			resumeTarget: { kind: "question", questionIndex: 2 },
		});
	});

	test("continues generation when every question was saved before interruption", () => {
		expect(
			getLearningPlanOverviewState({
				status: "questionsReady",
				questionCount: 5,
				answeredQuestionCount: 5,
				firstUnansweredQuestionIndex: null,
			}),
		).toMatchObject({
			kind: "creation",
			progressLabel: "5 von 5 Fragen beantwortet",
			resumeTarget: { kind: "generation" },
		});
	});

	test("keeps accepted plans in the created-plan presentation", () => {
		expect(
			getLearningPlanOverviewState({
				status: "accepted",
			}),
		).toEqual({ kind: "created" });
	});
});
