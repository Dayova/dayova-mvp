import { ROUTES, withReturnTo } from "~/lib/routes";
import type { DayEntry } from "~/types/dayEntries";

export function getAgendaPlanRoute(entry: DayEntry) {
	return entry.relatedLearningPlanId
		? withReturnTo(
				`/learning-plans/${encodeURIComponent(entry.relatedLearningPlanId)}`,
				ROUTES.home,
			)
		: null;
}
