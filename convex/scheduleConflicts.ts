import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getDayKeyQueryVariants } from "./dayKeyVariants";
import { throwUserFacingError } from "./errors";

const timePattern = /^(\d{1,2}):(\d{2})$/;

const minutesFromTime = (time: string) => {
	const match = timePattern.exec(time.trim());
	if (!match) return null;

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

	return hours * 60 + minutes;
};

const timeFromMinutes = (minutes: number) => {
	const normalized = Math.max(0, minutes);
	const minutesInDay = 24 * 60;
	const dayOffset = Math.floor(normalized / minutesInDay);
	const minutesOfDay = normalized % minutesInDay;
	const hours = Math.floor(minutesOfDay / 60);
	const rest = minutesOfDay % 60;
	const daySuffix =
		dayOffset > 0 ? ` (+${dayOffset} ${dayOffset === 1 ? "Tag" : "Tage"})` : "";
	return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}${daySuffix}`;
};

const getInterval = ({
	time,
	durationMinutes,
}: {
	time?: string;
	durationMinutes?: number;
}) => {
	if (!time || !durationMinutes || durationMinutes <= 0) return null;

	const start = minutesFromTime(time);
	if (start === null) return null;

	return {
		start,
		end: start + durationMinutes,
	};
};

const overlaps = (
	first: { start: number; end: number },
	second: { start: number; end: number },
) => first.start < second.end && first.end > second.start;

const getConflictDateLabel = (entry: Doc<"dayEntries">) =>
	entry.plannedDateLabel ?? entry.dueDateLabel ?? entry.dayKey;

const getConflictMessage = (
	entry: Doc<"dayEntries">,
	interval: { start: number; end: number },
) =>
	`Dieser Zeitraum überschneidet sich mit "${entry.title}" am ${getConflictDateLabel(entry)} von ${timeFromMinutes(interval.start)} bis ${timeFromMinutes(interval.end)}.`;

export const assertNoScheduleConflict = async (
	ctx: MutationCtx,
	{
		ownerTokenIdentifier,
		dayKey,
		time,
		durationMinutes,
		excludeDayEntryId,
		excludeLearningPlanSessionId,
	}: {
		ownerTokenIdentifier: string;
		dayKey: string;
		time?: string;
		durationMinutes?: number;
		excludeDayEntryId?: Id<"dayEntries">;
		excludeLearningPlanSessionId?: Id<"learningPlanSessions">;
	},
) => {
	const newInterval = getInterval({ time, durationMinutes });
	if (!newInterval) return;

	const existingEntries = [];
	for (const queryDayKey of getDayKeyQueryVariants(dayKey)) {
		const entries = ctx.db
			.query("dayEntries")
			.withIndex("by_ownerTokenIdentifier_and_dayKey", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("dayKey", queryDayKey),
			);
		for await (const entry of entries) {
			existingEntries.push(entry);
		}
	}

	const seenEntryIds = new Set<string>();
	for (const entry of existingEntries) {
		if (seenEntryIds.has(entry._id)) continue;
		seenEntryIds.add(entry._id);
		if (excludeDayEntryId && entry._id === excludeDayEntryId) continue;
		if (
			excludeLearningPlanSessionId &&
			entry.relatedLearningPlanSessionId === excludeLearningPlanSessionId
		) {
			continue;
		}

		const existingInterval = getInterval(entry);
		if (existingInterval && overlaps(newInterval, existingInterval)) {
			throwUserFacingError(getConflictMessage(entry, existingInterval));
		}
	}
};
