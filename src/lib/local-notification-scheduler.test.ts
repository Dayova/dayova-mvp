import { expect, test, vi } from "vitest";
import {
	type RegisteredLocalNotification,
	syncPlannedLocalNotifications,
} from "./local-notification-scheduler";

test("syncPlannedLocalNotifications replaces Dayova-owned scheduled notifications", async () => {
	const cancelScheduledNotificationAsync = vi.fn();
	const scheduleNotificationAsync = vi.fn(async () => "new-id");
	const notifications = {
		SchedulableTriggerInputTypes: { DATE: "date" },
		getAllScheduledNotificationsAsync: vi.fn(async () => [
			{
				identifier: "old-dayova",
				content: { data: { dayovaNotificationKey: "before:old:15" } },
			},
			{
				identifier: "other-app-work",
				content: { data: { anotherKey: "leave-me-alone" } },
			},
		]),
		cancelScheduledNotificationAsync,
		scheduleNotificationAsync,
	};
	const plan: RegisteredLocalNotification[] = [
		{
			key: "before:entry-1",
			type: "beforeEvent",
			category: "task",
			title: "Hausaufgabe",
			body: "Deine Mathe Hausaufgabe startet in 15 Minuten.",
			triggerAt: new Date(2026, 5, 16, 15, 45),
			relatedEntryId: "entry-1",
			registrationId: "registration-1",
		},
	];

	await expect(
		syncPlannedLocalNotifications(notifications, plan, "user-1"),
	).resolves.toEqual({ cancelled: 1, scheduled: 1 });
	expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("old-dayova");
	expect(cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
		"other-app-work",
	);
	expect(scheduleNotificationAsync).toHaveBeenCalledWith({
		content: {
			title: "Hausaufgabe",
			body: "Deine Mathe Hausaufgabe startet in 15 Minuten.",
			data: {
				dayovaNotificationKey: "before:entry-1",
				dayovaOwnerId: "user-1",
				dayovaNotificationRegistrationId: "registration-1",
			},
		},
		trigger: {
			type: "date",
			date: new Date(2026, 5, 16, 15, 45),
			channelId: "dayova-reminders",
		},
	});
});
