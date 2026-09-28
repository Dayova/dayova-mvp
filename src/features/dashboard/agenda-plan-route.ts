import type { DayEntry } from "~/types/dayEntries";

export function getAgendaPlanRoute(entry: DayEntry) {
	return entry.relatedLearningPlanId
		? `/learning-plans/${encodeURIComponent(entry.relatedLearningPlanId)}`
		: null;
}
