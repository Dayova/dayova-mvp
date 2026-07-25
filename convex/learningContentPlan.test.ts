import { describe, expect, test } from "vitest";
import { createLearningContentPlan } from "./learningContentPlan";

const topics = [
	{
		id: "aequivalenzumformungen",
		title: "Äquivalenzumformungen",
		learningGoal: "Gleichungen umformen, ohne die Lösungsmenge zu verändern.",
		keywords: ["Gleichung", "Äquivalenz"],
		priority: "high" as const,
	},
	{
		id: "vorzeichen",
		title: "Vorzeichen und Klammern",
		learningGoal: "Vorzeichen beim Auflösen von Klammern sicher behandeln.",
		keywords: ["Vorzeichen", "Klammern"],
		priority: "high" as const,
	},
	{
		id: "probe",
		title: "Probe durch Einsetzen",
		learningGoal: "Lösungen durch Einsetzen überprüfen.",
		keywords: ["Probe", "Einsetzen"],
		priority: "medium" as const,
	},
];

describe("learning content plan", () => {
	test("fills a split session with three timed learning blocks", () => {
		const plan = createLearningContentPlan({
			segments: [
				{ phase: "theory", durationMinutes: 20 },
				{ phase: "practice", durationMinutes: 10 },
			],
			topics,
		});

		expect(
			plan.blocks.map((block) => ({
				phase: block.phase,
				durationMinutes: block.durationMinutes,
				questionCount: block.questions.length,
			})),
		).toEqual([
			{ phase: "theory", durationMinutes: 10, questionCount: 3 },
			{ phase: "theory", durationMinutes: 10, questionCount: 3 },
			{ phase: "practice", durationMinutes: 10, questionCount: 2 },
		]);

		for (const block of plan.blocks) {
			expect(block.questions.length).toBeGreaterThanOrEqual(2);
			expect(
				block.questions.reduce(
					(total, question) => total + question.estimatedSeconds,
					0,
				),
			).toBe(block.durationMinutes * 60);
		}

		const coverageKeys = plan.blocks.flatMap((block) =>
			block.questions.map((question) => question.coverageKey),
		);
		expect(new Set(coverageKeys).size).toBe(coverageKeys.length);
	});

	test("continues with uncovered questions instead of repeating a block", () => {
		const initial = createLearningContentPlan({
			segments: [{ phase: "practice", durationMinutes: 10 }],
			topics,
		});
		const usedCoverageKeys = initial.blocks.flatMap((block) =>
			block.questions.map((question) => question.coverageKey),
		);

		const continuation = createLearningContentPlan({
			segments: [{ phase: "practice", durationMinutes: 10 }],
			topics,
			excludedCoverageKeys: usedCoverageKeys,
			blockIndexOffset: 1,
		});

		expect(continuation.blocks[0]?.index).toBe(1);
		expect(
			continuation.blocks[0]?.questions.reduce(
				(total, question) => total + question.estimatedSeconds,
				0,
			),
		).toBe(10 * 60);
		expect(
			continuation.blocks[0]?.questions.some((question) =>
				usedCoverageKeys.includes(question.coverageKey),
			),
		).toBe(false);
	});

	test("can generate one cost-efficient AI payload for a complete short session", () => {
		const plan = createLearningContentPlan({
			segments: [{ phase: "practice", durationMinutes: 20 }],
			topics,
			maxBlockMinutes: 20,
		});

		expect(plan.blocks).toHaveLength(1);
		expect(plan.blocks[0]?.durationMinutes).toBe(20);
		expect(plan.blocks[0]?.questions.length).toBeGreaterThanOrEqual(3);
	});
});
