export type TimetableLessonDraft = {
	key: string;
	dayOfWeek: number;
	subject: string;
	startTime: string;
	endTime: string;
	room: string;
};

export const TIMETABLE_WEEKDAYS = [
	{ value: 1, shortLabel: "Mo", label: "Montag" },
	{ value: 2, shortLabel: "Di", label: "Dienstag" },
	{ value: 3, shortLabel: "Mi", label: "Mittwoch" },
	{ value: 4, shortLabel: "Do", label: "Donnerstag" },
	{ value: 5, shortLabel: "Fr", label: "Freitag" },
	{ value: 6, shortLabel: "Sa", label: "Samstag" },
	{ value: 7, shortLabel: "So", label: "Sonntag" },
] as const;

export const timetableTimeToMinutes = (time: string) => {
	const match = /^(\d{2}):(\d{2})$/.exec(time);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
};

export const getTimetableLessonError = (
	lessons: TimetableLessonDraft[],
): string | null => {
	if (lessons.length === 0) {
		return "Füge mindestens eine Unterrichtsstunde hinzu.";
	}

	const normalized = lessons.map((lesson) => {
		const start = timetableTimeToMinutes(lesson.startTime);
		const end = timetableTimeToMinutes(lesson.endTime);
		if (!lesson.subject.trim()) {
			return { lesson, start, end, error: "Gib für jede Stunde ein Fach an." };
		}
		if (start === null || end === null || end <= start) {
			return {
				lesson,
				start,
				end,
				error: `Prüfe die Uhrzeit für ${lesson.subject.trim()}.`,
			};
		}
		return { lesson, start, end, error: null };
	});
	const invalid = normalized.find((item) => item.error);
	if (invalid?.error) return invalid.error;

	const sorted = [...normalized].sort(
		(left, right) =>
			left.lesson.dayOfWeek - right.lesson.dayOfWeek ||
			(left.start ?? 0) - (right.start ?? 0),
	);
	for (let index = 1; index < sorted.length; index += 1) {
		const previous = sorted[index - 1];
		const current = sorted[index];
		if (
			previous &&
			current &&
			previous.lesson.dayOfWeek === current.lesson.dayOfWeek &&
			(previous.end ?? 0) > (current.start ?? 0)
		) {
			return `${previous.lesson.subject.trim()} und ${current.lesson.subject.trim()} überschneiden sich.`;
		}
	}

	return null;
};

export const sortTimetableLessons = (
	lessons: TimetableLessonDraft[],
): TimetableLessonDraft[] =>
	[...lessons].sort(
		(left, right) =>
			left.dayOfWeek - right.dayOfWeek ||
			(timetableTimeToMinutes(left.startTime) ?? 0) -
				(timetableTimeToMinutes(right.startTime) ?? 0),
	);

export const createEmptyTimetableLesson = (
	key: string,
): TimetableLessonDraft => ({
	key,
	dayOfWeek: 1,
	subject: "",
	startTime: "08:00",
	endTime: "08:45",
	room: "",
});
