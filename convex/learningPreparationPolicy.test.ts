import { describe, expect, test } from "vitest";
import {
	getDefaultPreparationDepth,
	recommendLearningPreparation,
} from "./learningPreparationPolicy";

describe("learning preparation policy", () => {
	test("uses assessment-aware preparation-depth defaults", () => {
		expect(getDefaultPreparationDepth("Test")).toBe("compact");
		expect(getDefaultPreparationDepth("Klassenarbeit")).toBe("thorough");
		expect(getDefaultPreparationDepth("Klausur")).toBe("intensive");
		expect(getDefaultPreparationDepth("Präsentation")).toBe("thorough");
	});

	test("recommends substantially more preparation for a Klassenarbeit than a Test", () => {
		const testRecommendation = recommendLearningPreparation({
			examTypeLabel: "Test",
			examDurationMinutes: 30,
			preparationDepth: "compact",
			topicReadiness: { secure: 2, developing: 2, unknown: 1 },
			availableMinutes: 300,
		});
		const classExamRecommendation = recommendLearningPreparation({
			examTypeLabel: "Klassenarbeit",
			examDurationMinutes: 60,
			preparationDepth: "thorough",
			topicReadiness: { secure: 1, developing: 2, unknown: 3 },
			availableMinutes: 600,
		});

		expect(testRecommendation.recommendedMinutes).toBe(60);
		expect(classExamRecommendation.recommendedMinutes).toBe(180);
		expect(classExamRecommendation.praxisSessionCount).toBe(2);
	});

	test("exposes a preparation gap instead of claiming reduced availability is enough", () => {
		expect(
			recommendLearningPreparation({
				examTypeLabel: "Klassenarbeit",
				examDurationMinutes: 60,
				preparationDepth: "thorough",
				topicReadiness: { secure: 1, developing: 2, unknown: 3 },
				availableMinutes: 90,
			}),
		).toMatchObject({
			recommendedMinutes: 180,
			plannedMinutes: 90,
			preparationGapMinutes: 90,
		});
	});

	test("treats known zero availability as a full preparation gap", () => {
		expect(
			recommendLearningPreparation({
				examTypeLabel: "Klassenarbeit",
				examDurationMinutes: 45,
				preparationDepth: "thorough",
				topicReadiness: { secure: 0, developing: 0, unknown: 0 },
				availableMinutes: 0,
			}),
		).toMatchObject({
			plannedMinutes: 0,
			preparationGapMinutes: 180,
		});
	});
});
