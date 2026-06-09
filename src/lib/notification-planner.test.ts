import { expect, test } from "vitest";
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
					id: "entry-1",
					title: "Mathe Hausaufgabe",
					time: "16:00",
					kind: "Hausaufgabe",
					durationMinutes: 45,
					completed: false,
				},
				{
					id: "entry-2",
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
	expect(plan.map((notification) => notification.triggerAt.getHours())).toEqual([
		7, 15, 17,
	]);
	expect(plan.map((notification) => notification.triggerAt.getMinutes())).toEqual([
		30, 45, 0,
	]);
	expect(plan.map((notification) => notification.title)).toEqual([
		"Tagesüberblick",
		"Hausaufgabe",
		"Hausaufgabe nicht vergessen",
	]);
});
