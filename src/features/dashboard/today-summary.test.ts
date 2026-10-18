import { expect, test } from "vitest";
import type { DayEntry } from "~/types/dayEntries";
import { getTodaySummary } from "./today-summary";

const session = (completed = false) =>
	({
		id: "session",
		relatedLearningPlanSessionId: "session",
		completed,
	}) as DayEntry;

test("summarizes today's open steps, not passed times or unrelated entries", () => {
	expect(getTodaySummary(undefined)).toBe(
		"Dein nächster Lernschritt und deine Woche.",
	);
	expect(getTodaySummary([])).toBe("Heute ist kein Lernschritt geplant.");
	expect(getTodaySummary([session()])).toBe(
		"Heute ist noch ein Lernschritt offen.",
	);
	expect(getTodaySummary([session(), session(), session(true)])).toBe(
		"Heute sind noch 2 Lernschritte offen.",
	);
	expect(getTodaySummary([session(true)])).toBe(
		"Alle Lernschritte für heute sind erledigt.",
	);
	expect(
		getTodaySummary([
			{ ...session(), executionStatus: "started", completed: true },
		]),
	).toBe("Heute ist noch ein Lernschritt offen.");
});
