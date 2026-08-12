import type { PlanSession } from "~/features/learning-plans/types";

const historyStatuses = new Set<PlanSession["executionStatus"]>([
	"completed",
	"partiallyCompleted",
	"missed",
	"adjusted",
]);

export const isLearningPlanSessionHistory = (session: PlanSession) =>
	session.completed || historyStatuses.has(session.executionStatus);

export const isDiagnosticLearningPlanSession = (session: PlanSession) =>
	session.sessionPurpose === "diagnostic";

export const getRollingLearningWindowLabel = ({
	completedCount,
	upcomingCount,
}: {
	completedCount: number;
	upcomingCount: number;
}) => {
	const safeCompletedCount = Math.max(0, Math.trunc(completedCount));
	const safeUpcomingCount = Math.max(0, Math.trunc(upcomingCount));
	const upcomingLabel =
		safeUpcomingCount === 0
			? "keine weiteren Termine geplant"
			: safeUpcomingCount === 1
				? "1 weiterer Termin geplant"
				: `${safeUpcomingCount} weitere Termine geplant`;

	return `${safeCompletedCount} abgeschlossen · ${upcomingLabel}`;
};

export const getCommittedSessionIndex = (sessions: PlanSession[]) => {
	const index = sessions.findIndex(
		(session) =>
			["notStarted", "started"].includes(session.executionStatus) &&
			session.planningStatus !== "provisional",
	);
	return index === -1 ? null : index;
};

export const getDefaultLearningPlanSession = (sessions: PlanSession[]) => {
	const committedIndex = getCommittedSessionIndex(sessions);
	return committedIndex === null
		? (sessions.at(-1) ?? null)
		: (sessions[committedIndex] ?? null);
};
