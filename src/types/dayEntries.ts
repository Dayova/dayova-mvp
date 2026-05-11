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
	relatedLearningPlanId?: Id<"learningPlans">;
	relatedLearningPlanSessionId?: Id<"learningPlanSessions">;
};
