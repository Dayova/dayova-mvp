import type { OptimisticUpdate } from "convex/browser";
import type { FunctionArgs } from "convex/server";
import { api } from "#convex/_generated/api";

/** Keep every loaded representation in sync; Convex rebases or rolls back this layer. */
export const optimisticEntryCompletion: OptimisticUpdate<
	FunctionArgs<typeof api.dayEntries.setCompleted>
> = (store, { id, completed }) => {
	const entry = store.getQuery(api.dayEntries.get, { id });
	// Learning sessions own their completion workflow and cannot use this mutation.
	if (entry?.relatedLearningPlanSessionId) return;
	if (entry) {
		store.setQuery(api.dayEntries.get, { id }, { ...entry, completed });
	}

	for (const { args, value } of store.getAllQueries(
		api.dayEntries.listByDayKeys,
	)) {
		if (value === undefined || args.cacheScope === "notificationPlanning")
			continue;
		store.setQuery(
			api.dayEntries.listByDayKeys,
			args,
			Object.fromEntries(
				Object.entries(value).map(([dayKey, entries]) => [
					dayKey,
					entries.map((item) =>
						item.id === id && !item.relatedLearningPlanSessionId
							? { ...item, completed }
							: item,
					),
				]),
			),
		);
	}

	const homework = store.getQuery(api.dayEntries.listHomeworkOverview, {});
	if (homework !== undefined) {
		store.setQuery(
			api.dayEntries.listHomeworkOverview,
			{},
			homework.map((item) => (item.id === id ? { ...item, completed } : item)),
		);
	}
};
