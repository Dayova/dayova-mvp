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

test("keeps existing short theory allocations as separate sessions", () => {
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
	).toEqual([10, 10]);
});

test("rebalances a theory-heavy plan into an interleaved practice-first mix", () => {
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

	const minutesFor = (phase: "theory" | "practice" | "rehearsal") =>
		sessions
			.filter((entry) => entry.phase === phase)
			.reduce((total, entry) => total + entry.durationMinutes, 0);
	expect(minutesFor("theory")).toBe(15);
	expect(minutesFor("practice")).toBe(30);
	expect(minutesFor("rehearsal")).toBe(15);
	expect(
		sessions.every(
			(entry, index) =>
				entry.phase !== "theory" || sessions[index - 1]?.phase !== "theory",
		),
	).toBe(true);
	expect(
		sessions.reduce((total, entry) => total + entry.durationMinutes, 0),
	).toBe(60);
});

test("preserves the available minutes when a short phase tail meets a short window tail", () => {
	const sessions = [
		session({ phase: "theory", startTime: "17:00", durationMinutes: 7 }),
		session({ phase: "theory", startTime: "17:07", durationMinutes: 6 }),
		session({ phase: "practice", startTime: "17:13", durationMinutes: 12 }),
	];

	const balanced = rebalanceLearningPhases({ sessions, phaseFallbacks });

	expect(
		balanced.reduce((total, entry) => total + entry.durationMinutes, 0),
	).toBe(25);
	expect(balanced.every((entry) => entry.durationMinutes >= 5)).toBe(true);
});
