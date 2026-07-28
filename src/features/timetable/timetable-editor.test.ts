import { describe, expect, test } from "vitest";
import {
	createEmptyTimetableLesson,
	getTimetableLessonError,
	sortTimetableLessons,
	type TimetableLessonDraft,
} from "./timetable-editor";

const lesson = (
	patch: Partial<TimetableLessonDraft> = {},
): TimetableLessonDraft => ({
	...createEmptyTimetableLesson("lesson"),
	subject: "Mathematik",
	...patch,
});

describe("timetable lesson editor", () => {
	test("requires a verified lesson", () => {
		expect(getTimetableLessonError([])).toBe(
			"Füge mindestens eine Unterrichtsstunde hinzu.",
		);
		expect(getTimetableLessonError([lesson({ subject: "" })])).toBe(
			"Gib für jede Stunde ein Fach an.",
		);
	});

	test("rejects invalid and overlapping time ranges", () => {
		expect(
			getTimetableLessonError([
				lesson({ startTime: "09:00", endTime: "08:45" }),
			]),
		).toBe("Prüfe die Uhrzeit für Mathematik.");
		expect(
			getTimetableLessonError([
				lesson({ key: "one", startTime: "08:00", endTime: "08:45" }),
				lesson({
					key: "two",
					subject: "Deutsch",
					startTime: "08:30",
					endTime: "09:15",
				}),
			]),
		).toBe("Mathematik und Deutsch überschneiden sich.");
	});

	test("sorts lessons by weekday and start time", () => {
		const sorted = sortTimetableLessons([
			lesson({ key: "tuesday", dayOfWeek: 2 }),
			lesson({ key: "late", startTime: "10:00", endTime: "10:45" }),
			lesson({ key: "early", startTime: "08:00", endTime: "08:45" }),
		]);
		expect(sorted.map((item) => item.key)).toEqual([
			"early",
			"late",
			"tuesday",
		]);
	});
});
