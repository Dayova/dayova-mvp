import { expect, test } from "vitest";
import {
	rebalanceLearningPhases,
	type SchedulableLearningSession,
	splitLargeTheorySessions,
} from "./learningSessionSegmentation";

const phaseFallbacks = {
	theory: {
		title: "Theorie",
		goal: "Lerne die Grundlagen.",
		tasks: ["Lies die Regeln."],
		expectedOutcome: "Du kennst die Grundlagen.",
	},
	practice: {
		title: "Übungsblock",
		goal: "Übe typische Aufgaben.",
		tasks: ["Löse Aufgaben."],
		expectedOutcome: "Du hast Aufgaben geübt.",
	},
	rehearsal: {
		title: "Praxis",
		goal: "Bearbeite einen Probetest.",
		tasks: ["Löse den Probetest."],
		expectedOutcome: "Du kennst offene Lücken.",
	},
};

const session = ({
	phase,
	startTime,
	durationMinutes,
}: {
	phase: "theory" | "practice" | "rehearsal";
	startTime: string;
	durationMinutes: number;
}): SchedulableLearningSession<"theory" | "practice" | "rehearsal"> => ({
	phase,
	title: phaseFallbacks[phase].title,
	dateKey: "2026-07-22T00:00:00.000Z",
	dateLabel: "22. Juli 2026",
	startTime,
	durationMinutes,
	goal: phaseFallbacks[phase].goal,
	tasks: phaseFallbacks[phase].tasks,
	expectedOutcome: phaseFallbacks[phase].expectedOutcome,
});

test("turns two fragmented theory allocations into three short sessions", () => {
	const sessions = splitLargeTheorySessions({
		sessions: [
			session({ phase: "theory", startTime: "17:00", durationMinutes: 10 }),
			session({ phase: "theory", startTime: "17:10", durationMinutes: 10 }),
			session({ phase: "practice", startTime: "17:20", durationMinutes: 5 }),
			session({ phase: "rehearsal", startTime: "17:25", durationMinutes: 5 }),
		],
		topics: [],
		maxSessions: 20,
		maxTitleChars: 28,
	});

	expect(
		sessions
			.filter((entry) => entry.phase === "theory")
			.map((entry) => entry.durationMinutes),
	).toEqual([5, 5, 10]);
});

test("caps highly fragmented availability at five theory sessions", () => {
	const balanced = rebalanceLearningPhases({
		sessions: [
			...Array.from({ length: 6 }, (_, index) =>
				session({
					phase: "theory",
					startTime: `17:${String(index * 5).padStart(2, "0")}`,
					durationMinutes: 5,
				}),
			),
			session({ phase: "practice", startTime: "17:30", durationMinutes: 20 }),
			session({ phase: "rehearsal", startTime: "17:50", durationMinutes: 10 }),
		],
		phaseFallbacks,
	});
	const sessions = splitLargeTheorySessions({
		sessions: balanced,
		topics: [],
		maxSessions: 20,
		maxTitleChars: 28,
	});

	expect(sessions.filter((entry) => entry.phase === "theory")).toHaveLength(5);
	expect(
		sessions.reduce((total, entry) => total + entry.durationMinutes, 0),
	).toBe(60);
});
