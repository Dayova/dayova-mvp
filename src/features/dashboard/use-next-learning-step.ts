import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect } from "react";
import { api } from "#convex/_generated/api";
import { toDashboardAgendaItem } from "./dashboard-agenda";

type Candidate = FunctionReturnType<
	typeof api.dashboardNextStep.listCandidates
>["page"][number];

/** Settle after the earliest eligible day is complete; legacy pages must still be exhausted. */
export function selectNextLearningCandidate(
	rows: Candidate[],
	exhausted: boolean,
	chronological = false,
) {
	const next = rows
		.flatMap((row) => (row.step ? [row.step] : []))
		.sort(
			(a, b) =>
				a.dayKey.localeCompare(b.dayKey) ||
				a.session.startTime.localeCompare(b.session.startTime),
		)[0];
	const settled =
		exhausted ||
		(chronological &&
			next !== undefined &&
			rows.some((row) => row.scanDateKey > next.dayKey));
	return { next: settled ? next : undefined, settled };
}

/** Pages forward until an eligible step is settled; skipped pages never imply an empty state. */
export function useNextLearningStep(todayKey: string, enabled: boolean) {
	const indexReady = useQuery(
		api.dashboardNextStep.isDayIndexReady,
		enabled ? {} : "skip",
	);
	const { results, status, loadMore } = usePaginatedQuery(
		api.dashboardNextStep.listCandidates,
		enabled && indexReady !== undefined
			? { todayKey, useDayIndex: indexReady }
			: "skip",
		{ initialNumItems: 32 },
	);
	const { next, settled } = selectNextLearningCandidate(
		results,
		status === "Exhausted",
		indexReady === true,
	);
	useEffect(() => {
		if (enabled && !settled && status === "CanLoadMore") loadMore(32);
	}, [enabled, settled, status, loadMore]);
	return {
		isLoading: !enabled || indexReady === undefined || !settled,
		item: next
			? toDashboardAgendaItem(next.dayKey, {
					id: next.session._id,
					title: next.session.title,
					subject: next.subject,
					time: next.session.startTime,
					kind: "Lernen",
					durationMinutes: next.session.durationMinutes,
					executionStatus: next.session.executionStatus,
					completed: next.session.completed,
					relatedLearningPlanId: next.session.learningPlanId,
					relatedLearningPlanSessionId: next.session._id,
				})
			: undefined,
		plan: next
			? {
					subject: next.subject,
					currentSession: {
						id: next.session._id,
						goal: next.session.goal,
						sessionPurpose: next.session.sessionPurpose,
					},
				}
			: undefined,
	};
}
