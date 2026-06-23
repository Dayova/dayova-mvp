import type { Id } from "#convex/_generated/dataModel";
import type {
	MissedReason,
	SessionExecutionStatus,
} from "~/features/learning-plans/types";

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
	executionStatus?: SessionExecutionStatus;
	startedAt?: number;
	outcomeAt?: number;
	missedReason?: MissedReason;
	adjustedFromSessionId?: Id<"learningPlanSessions">;
	relatedLearningPlanId?: Id<"learningPlans">;
	relatedLearningPlanSessionId?: Id<"learningPlanSessions">;
};
