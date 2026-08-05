import { describe, expect, test } from "vitest";
import {
	type AdaptiveTopicEvidence,
	selectNextAdaptiveLearningTarget,
} from "./adaptiveLearningPlanPolicy";

const topics = [
	{
		id: "steigung",
		title: "Steigung berechnen",
		learningGoal: "Steigungen aus zwei Punkten berechnen.",
		keywords: ["Steigung"],
		priority: "high" as const,
		requiredEvidenceDimensions: [
			"understanding" as const,
			"problemSolving" as const,
			"independent" as const,
		],
	},
	{
		id: "achsenschnitt",
		title: "Achsenschnittpunkte",
		learningGoal: "Achsenschnittpunkte sicher bestimmen.",
		keywords: ["Achse"],
		priority: "medium" as const,
		requiredEvidenceDimensions: ["understanding" as const],
	},
];

const evidence = (
	overrides: Partial<AdaptiveTopicEvidence>,
): AdaptiveTopicEvidence => ({
	topicId: "steigung",
	dimension: "understanding",
	rating: "correct",
	sessionId: "session-1",
	createdAt: 1,
	...overrides,
});

describe("adaptive learning plan policy", () => {
	test("starts with understanding when a high-priority topic is unknown", () => {
		expect(
			selectNextAdaptiveLearningTarget({
				topics,
				initialReadiness: [],
				evidence: [],
			}),
		).toMatchObject({
			topicId: "steigung",
			dimension: "understanding",
			phase: "theory",
			status: "unknown",
		});
	});

	test("moves to problem solving after understanding is secure", () => {
		expect(
			selectNextAdaptiveLearningTarget({
				topics,
				initialReadiness: [{ topicId: "steigung", status: "secure" }],
				evidence: [],
			}),
		).toMatchObject({
			topicId: "steigung",
			dimension: "problemSolving",
			phase: "practice",
		});
	});

	test("moves from one theory exposure to guided practice for the same topic", () => {
		expect(
			selectNextAdaptiveLearningTarget({
				topics,
				initialReadiness: [],
				evidence: [],
				history: [
					{
						topicId: "steigung",
						dimension: "understanding",
						targetedAt: 1,
					},
				],
			}),
		).toMatchObject({
			topicId: "steigung",
			dimension: "problemSolving",
			phase: "practice",
		});
	});

	test("uses independent work after repeated problem-solving success", () => {
		const attempts = [
			evidence({
				dimension: "problemSolving",
				sessionId: "practice-1",
				createdAt: 1,
			}),
			evidence({
				dimension: "problemSolving",
				sessionId: "practice-2",
				createdAt: 2,
			}),
		];

		expect(
			selectNextAdaptiveLearningTarget({
				topics,
				initialReadiness: [{ topicId: "steigung", status: "secure" }],
				evidence: attempts,
			}),
		).toMatchObject({
			dimension: "independent",
			phase: "rehearsal",
		});
	});

	test("prioritizes a contradictory result as a control check", () => {
		const attempts = [
			evidence({ sessionId: "understanding-1", createdAt: 1 }),
			evidence({ sessionId: "understanding-2", createdAt: 2 }),
			evidence({
				sessionId: "understanding-3",
				createdAt: 3,
				rating: "notCorrect",
			}),
		];

		expect(
			selectNextAdaptiveLearningTarget({
				topics,
				initialReadiness: [],
				evidence: attempts,
			}),
		).toMatchObject({
			topicId: "steigung",
			dimension: "understanding",
			needsControlCheck: true,
		});
	});

	test("can exclude the committed target when choosing the preview", () => {
		expect(
			selectNextAdaptiveLearningTarget({
				topics,
				initialReadiness: [],
				evidence: [],
				excludeTargetKeys: ["steigung:understanding"],
			}),
		).toMatchObject({
			topicId: "steigung",
			dimension: "problemSolving",
		});
	});

	test("returns no target when every required dimension is secure", () => {
		const attempts = [
			...(["understanding", "problemSolving", "independent"] as const).flatMap(
				(dimension, dimensionIndex) => [
					evidence({
						dimension,
						sessionId: `${dimension}-1`,
						createdAt: dimensionIndex * 2 + 1,
					}),
					evidence({
						dimension,
						sessionId: `${dimension}-2`,
						createdAt: dimensionIndex * 2 + 2,
					}),
				],
			),
			evidence({
				topicId: "achsenschnitt",
				sessionId: "axis-1",
				createdAt: 10,
			}),
			evidence({
				topicId: "achsenschnitt",
				sessionId: "axis-2",
				createdAt: 11,
			}),
		];

		expect(
			selectNextAdaptiveLearningTarget({
				topics,
				initialReadiness: [],
				evidence: attempts,
			}),
		).toBeNull();
	});
});
