import { expect, test } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

const schema = __testOnlyLearningPlanAi.generatedPlanSchema;
// Minimized from the grade-10 QA response (request 8950508c8b9e53fd).
const plan = (durationMinutes: number) => ({
	sourceSummary: "Grundlagen linearer Funktionen und Gleichungen mit Klammern.",
	insight: {
		summary:
			"Der Wissensstand zu Steigungen und Gleichungen wird zunächst geprüft.",
		strengths: [],
		gaps: ["Verständnis der Parameter m und b"],
	},
	sessions: [
		{
			phase: "theory",
			title: "Wissenscheck & Grundlagen",
			dayOffsetBeforeExam: 0,
			startTime: "16:00",
			durationMinutes,
			goal: "Ermittlung des Wissensstandes zu linearen Funktionen und Klammerregeln.",
			tasks: [
				"Fragen zu m und b beantworten",
				"Einfache Funktionswerte berechnen",
			],
			expectedOutcome:
				"Klarheit über vorhandene Wissenslücken bei den Funktionsparametern.",
		},
	],
});

test.each([
	10, 15, 20, 180,
])("accepts supported %i-minute plan archetypes", (minutes) => {
	expect(schema.safeParse(plan(minutes)).success).toBe(true);
});

test.each([
	0, 9, 10.5, 181,
])("rejects invalid %i-minute plan archetypes", (minutes) => {
	expect(schema.safeParse(plan(minutes)).success).toBe(false);
});
