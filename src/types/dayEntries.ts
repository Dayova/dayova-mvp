import type { Id } from "#convex/_generated/dataModel";

export type DayEntry = {
	id: Id<"dayEntries"> | Id<"learningPlanSessions">;
	title?: unknown;
	time?: string;
	kind?: string;
	notes?: string;
	dueDateKey?: string;
	dueDateLabel?: string;
	plannedDateLabel?: string;
	durationMinutes?: number;
	examTypeLabel?: string;
	completed?: boolean;
	executionStatus?:
		| "notStarted"
		| "started"
		| "completed"
		| "partiallyCompleted"
		| "missed"
		| "adjusted";
	startedAt?: number;
	outcomeAt?: number;
	missedReason?:
		| "no_time"
		| "forgot"
		| "no_motivation"
		| "too_hard"
		| "too_big"
		| "unclear"
		| "other";
	adjustedFromSessionId?: Id<"learningPlanSessions">;
	relatedLearningPlanId?: Id<"learningPlans">;
	relatedLearningPlanSessionId?: Id<"learningPlanSessions">;
};
