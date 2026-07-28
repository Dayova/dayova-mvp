import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type TimetableReadCtx = Pick<QueryCtx | MutationCtx, "db">;

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const getTimetableDayOfWeek = (dayKey: string) => {
	const match = DAY_KEY_PATTERN.exec(dayKey);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return null;
	}

	const sundayBasedDay = date.getUTCDay();
	return sundayBasedDay === 0 ? 7 : sundayBasedDay;
};

export const getActiveTimetable = async (
	ctx: TimetableReadCtx,
	ownerTokenIdentifier: string,
) => {
	const activeTimetables = await ctx.db
		.query("timetables")
		.withIndex("by_ownerTokenIdentifier_and_status", (q) =>
			q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("status", "active"),
		)
		.order("desc")
		.take(1);

	return activeTimetables[0] ?? null;
};

export const getActiveTimetableLessonsForDayKey = async (
	ctx: TimetableReadCtx,
	ownerTokenIdentifier: string,
	dayKey: string,
): Promise<Doc<"timetableLessons">[]> => {
	const dayOfWeek = getTimetableDayOfWeek(dayKey);
	if (dayOfWeek === null) return [];

	const lessons = await getActiveTimetableLessons(ctx, ownerTokenIdentifier);
	return lessons.filter((lesson) => lesson.dayOfWeek === dayOfWeek);
};

export const getActiveTimetableLessons = async (
	ctx: TimetableReadCtx,
	ownerTokenIdentifier: string,
): Promise<Doc<"timetableLessons">[]> => {
	const timetable = await getActiveTimetable(ctx, ownerTokenIdentifier);
	if (!timetable) return [];

	return await ctx.db
		.query("timetableLessons")
		.withIndex("by_timetableId_and_dayOfWeek_and_startTime", (q) =>
			q.eq("timetableId", timetable._id),
		)
		.take(150);
};

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export const timetableTimeToMinutes = (time: string) => {
	const match = TIME_PATTERN.exec(time);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
};

export const getTimetableLessonDuration = (
	lesson: Pick<Doc<"timetableLessons">, "startTime" | "endTime">,
) => {
	const start = timetableTimeToMinutes(lesson.startTime);
	const end = timetableTimeToMinutes(lesson.endTime);
	if (start === null || end === null || end <= start) return null;
	return end - start;
};
