import type { PlanSession } from "~/features/learning-plans/types";

const historyStatuses = new Set<PlanSession["executionStatus"]>([
	"completed",
	"partiallyCompleted",
	"missed",
	"adjusted",
]);

export const isLearningPlanSessionHistory = (session: PlanSession) =>
	session.completed || historyStatuses.has(session.executionStatus);

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
