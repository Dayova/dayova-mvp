import type { Id } from "#convex/_generated/dataModel";

export type DayEntry = {
	id: Id<"dayEntries">;
	title: string;
	time?: string;
	kind?: string;
	notes?: string;
	dueDateKey?: string;
	dueDateLabel?: string;
	plannedDateLabel?: string;
	durationMinutes?: number;
	examTypeLabel?: string;
};
