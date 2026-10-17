import { ROUTES, withReturnTo } from "~/lib/routes";
import type { DayEntry } from "~/types/dayEntries";

/** Builds a plan route returning to Today; unlinked entries have no plan route. */
export function getAgendaPlanRoute(entry: DayEntry) {
	return entry.relatedLearningPlanId
		? withReturnTo(
				`/learning-plans/${encodeURIComponent(entry.relatedLearningPlanId)}`,
				ROUTES.home,
			)
		: null;
}
