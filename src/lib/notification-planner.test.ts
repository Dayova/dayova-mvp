import { expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import type { DayEntry } from "~/types/dayEntries";
import {
	buildLocalNotificationPlan,
	type NotificationPlanningPreferences,
} from "./notification-planner";

const defaultPreferences: NotificationPlanningPreferences = {
	systemNotificationsEnabled: true,
	dailyBriefingEnabled: true,
	dailyBriefingTime: "07:30",
	beforeExamEnabled: true,
	beforeLearningTimeEnabled: true,
	beforeHomeworkWorkEnabled: true,
	beforeHomeworkDueEnabled: true,
	reminderOffsetMinutes: 15,
	forgottenEventEnabled: true,
};

test("local notification planner creates briefing, before-event, and forgotten reminders for incomplete entries", () => {
	const plan = buildLocalNotificationPlan({
		now: new Date(2026, 5, 16, 7, 0),
		preferences: defaultPreferences,
		entriesByDay: {
			"2026-06-16": [
				{
					relatedDayEntryId: "entry-1" as Id<"dayEntries">,
					title: "Mathe Hausaufgabe",
					time: "16:00",
					kind: "Hausaufgabe",
					durationMinutes: 45,
					completed: false,
				},
				{
					title: "Deutsch Hausaufgabe",
					time: "17:00",
					kind: "Hausaufgabe",
					durationMinutes: 45,
					completed: true,
				},
			],
		},
	});

	expect(plan.map((notification) => notification.key)).toEqual([
		"briefing:2026-06-16:07:30",
		"before:entry-1",
		"forgotten:entry-1",
	]);
	expect(plan.map((notification) => notification.triggerAt.getHours())).toEqual(
		[7, 15, 17],
	);
	expect(
		plan.map((notification) => notification.triggerAt.getMinutes()),
	).toEqual([30, 45, 0]);
	expect(plan.map((notification) => notification.title)).toEqual([
		"Tagesüberblick",
		"Hausaufgabe",
		"Hausaufgabe nicht vergessen",
	]);
	expect(plan.map((notification) => notification.body)).toEqual([
		"Heute steht 1 Eintrag an: Mathe Hausaufgabe um 16:00.",
		"Deine Mathe Hausaufgabe startet in 15 Minuten.",
		"Du kannst deine Mathe Hausaufgabe noch als erledigt markieren.",
	]);
});

test("timetable lessons appear in the briefing without creating individual reminders", () => {
	const timetableLesson = {
		id: "timetable-lesson-1" as Id<"timetableLessons">,
		source: "timetable",
		title: "Mathematik",
		time: "08:00",
		kind: "Unterricht",
		durationMinutes: 45,
	} satisfies DayEntry;
	const plan = buildLocalNotificationPlan({
		now: new Date(2026, 6, 27, 7, 0),
		preferences: defaultPreferences,
		entriesByDay: {
			"2026-07-27": [timetableLesson],
		},
	});

	expect(plan).toEqual([
		expect.objectContaining({
			key: "briefing:2026-07-27:07:30",
			type: "dailyBriefing",
			body: "Heute steht 1 Eintrag an: Mathematik um 08:00.",
		}),
	]);
});

const learningEntry = {
	relatedDayEntryId: "learning-1" as Id<"dayEntries">,
	title: "Mathe: Brüche",
	kind: "Lernen",
	time: "16:00",
	durationMinutes: 20,
	executionStatus: "notStarted",
};
const learningPlan = (
	entry = learningEntry,
	preferences = defaultPreferences,
) =>
	buildLocalNotificationPlan({
		now: new Date(2026, 5, 16, 7),
		preferences,
		entriesByDay: { "2026-06-16": [entry] },
	});

test("learning reminders run before, at start, and once 15 minutes after the end", () => {
	const reminders = learningPlan().filter(
		(item) => item.category === "learningPlan",
	);
	expect(
		reminders.map((item) => [
			item.type,
			item.triggerAt.getHours(),
			item.triggerAt.getMinutes(),
		]),
	).toEqual([
		["beforeEvent", 15, 45],
		["startEvent", 16, 0],
		["forgottenEvent", 16, 35],
	]);
	expect(reminders[0]?.body).toContain("20 Minuten");
	expect(reminders[2]?.body).toContain("Finde einen neuen Termin");
});

test("optional previews do not disable start or recovery reminders", () => {
	const plan = learningPlan(learningEntry, {
		...defaultPreferences,
		dailyBriefingEnabled: false,
		beforeLearningTimeEnabled: false,
	});
	expect(plan.map((item) => item.type)).toEqual([
		"startEvent",
		"forgottenEvent",
	]);
	expect(
		learningPlan(learningEntry, {
			...defaultPreferences,
			startLearningTimeEnabled: false,
		}).some((item) => item.type === "startEvent"),
	).toBe(false);
	expect(
		learningPlan(learningEntry, {
			...defaultPreferences,
			systemNotificationsEnabled: false,
		}),
	).toEqual([]);
});

test.each([
	"started",
	"completed",
	"partiallyCompleted",
	"missed",
	"adjusted",
])("does not nudge a learning session already handled as %s", (executionStatus) => {
	expect(learningPlan({ ...learningEntry, executionStatus })).toEqual([]);
});

test("empty or completed days do not produce a briefing", () => {
	expect(
		buildLocalNotificationPlan({
			now: new Date(2026, 5, 16, 7),
			preferences: defaultPreferences,
			entriesByDay: {
				"2026-06-16": [],
				"2026-06-17": [{ ...learningEntry, completed: true }],
			},
		}),
	).toEqual([]);
});

test("moving or deleting a learning entry replaces its planned times", () => {
	const moved = learningPlan({ ...learningEntry, time: "18:00" }).find(
		(item) => item.type === "startEvent",
	);
	expect(moved?.triggerAt.getHours()).toBe(18);
	expect(
		buildLocalNotificationPlan({
			now: new Date(2026, 5, 16, 7),
			preferences: defaultPreferences,
			entriesByDay: {},
		}),
	).toEqual([]);
});
