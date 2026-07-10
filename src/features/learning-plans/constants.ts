import type { SessionExecutionStatus } from "~/features/learning-plans/types";

export const SESSION_EXECUTION_STATUS_LABEL = {
	notStarted: "Offen",
	started: "Gestartet",
	completed: "Erledigt",
	partiallyCompleted: "Teilweise erledigt",
	missed: "Verpasst",
	adjusted: "Neu geplant",
} satisfies Record<SessionExecutionStatus, string>;
