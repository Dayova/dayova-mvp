import { describe, expect, it } from "vitest";
import { getDashboardKnowledgeProgressViewModel } from "./dashboard-knowledge-progress";

describe("dashboard knowledge progress", () => {
	it("shows the number of topics backed by secure evidence", () => {
		expect(
			getDashboardKnowledgeProgressViewModel({
				hasKnowledgeEvidence: true,
				hasLearningPlan: true,
				isLoading: false,
				secureTopics: 3,
				totalTopics: 5,
			}),
		).toEqual({
			accessibilityLabel:
				"Wissensstand: 3 von 5 Themen sicher. Details ansehen.",
			footer: "Details ansehen",
			progressPercent: 60,
			ringLabel: "Themen sicher",
			ringValue: "3 / 5",
		});
	});

	it("does not present missing evidence as zero ability", () => {
		expect(
			getDashboardKnowledgeProgressViewModel({
				hasKnowledgeEvidence: false,
				hasLearningPlan: true,
				isLoading: false,
				secureTopics: 0,
				totalTopics: 5,
			}),
		).toMatchObject({
			accessibilityLabel: "Wissensstand: Noch keine Wissensbelege",
			footer: "Noch keine Belege",
			ringValue: "–",
		});
	});

	it("handles loading, empty, singular, and complete states", () => {
		expect(
			getDashboardKnowledgeProgressViewModel({
				hasKnowledgeEvidence: false,
				hasLearningPlan: false,
				isLoading: true,
				secureTopics: 0,
				totalTopics: 0,
			}),
		).toMatchObject({
			footer: "Wissensstand",
			ringLabel: "wird geladen",
			ringValue: "–",
		});

		expect(
			getDashboardKnowledgeProgressViewModel({
				hasKnowledgeEvidence: false,
				hasLearningPlan: false,
				isLoading: false,
				secureTopics: 0,
				totalTopics: 0,
			}),
		).toMatchObject({
			footer: "Lernplan öffnen",
			ringValue: "–",
		});

		expect(
			getDashboardKnowledgeProgressViewModel({
				hasKnowledgeEvidence: true,
				hasLearningPlan: true,
				isLoading: false,
				secureTopics: 1,
				totalTopics: 1,
			}),
		).toMatchObject({
			footer: "Alle Themen sicher",
			progressPercent: 100,
			ringLabel: "Thema sicher",
			ringValue: "1 / 1",
		});
	});
});
