import type { DayEntry } from "~/types/dayEntries";

export function getTodaySummary(entries: DayEntry[] | undefined) {
	if (!entries) return "Dein nächster Lernschritt und deine Woche.";
	const sessions = entries.filter(
		(entry) => entry.relatedLearningPlanSessionId,
	);
	const open = sessions.filter((entry) =>
		entry.executionStatus
			? entry.executionStatus !== "completed"
			: !entry.completed,
	).length;
	if (open === 1) return "Heute ist noch ein Lernschritt offen.";
	if (open > 1) return `Heute sind noch ${open} Lernschritte offen.`;
	return sessions.length
		? "Alle Lernschritte für heute sind erledigt."
		: "Heute ist kein Lernschritt geplant.";
}
