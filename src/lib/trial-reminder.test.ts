import { describe, expect, it, vi } from "vitest";
import {
	buildTrialReminder,
	syncTrialReminderNotification,
} from "./trial-reminder";

const reminderAt = Date.parse("2026-08-09T10:00:00.000Z");

describe("buildTrialReminder", () => {
	it("plans the agreed Day-12 reminder for an active trial", () => {
		expect(
			buildTrialReminder({
				access: {
					state: "trial",
					reminderAt,
					trialExpiresAt: Date.parse("2026-08-11T10:00:00.000Z"),
				},
				now: Date.parse("2026-08-01T10:00:00.000Z"),
			}),
		).toEqual({
			body: "Deine kostenlose Testphase endet in 2 Tagen. Danach entscheidest du selbst, wie es weitergeht.",
			key: `trial-ending:${reminderAt}`,
			title: "Deine Testphase endet bald",
			triggerAt: new Date(reminderAt),
		});
	});

	it("does not schedule reminders for paid, expired, or already-due access", () => {
		expect(
			buildTrialReminder({
				access: { state: "paid" },
				now: Date.parse("2026-08-01T10:00:00.000Z"),
			}),
		).toBeNull();
		expect(
			buildTrialReminder({
				access: {
					state: "expired",
					reminderAt,
					trialExpiresAt: reminderAt,
				},
				now: reminderAt,
			}),
		).toBeNull();
		expect(
			buildTrialReminder({
				access: {
					state: "trial",
					reminderAt,
					trialExpiresAt: Date.parse("2026-08-11T10:00:00.000Z"),
				},
				now: reminderAt,
			}),
		).toBeNull();
	});
});

it("replaces only Dayova's dedicated trial reminder", async () => {
	const notifications = {
		SchedulableTriggerInputTypes: { DATE: "date" },
		cancelScheduledNotificationAsync: vi.fn(async () => undefined),
		getAllScheduledNotificationsAsync: vi.fn(async () => [
			{
				identifier: "old-trial",
				content: { data: { dayovaTrialReminderKey: "old" } },
			},
			{
				identifier: "learning-reminder",
				content: { data: { dayovaNotificationKey: "before:entry" } },
			},
		]),
		scheduleNotificationAsync: vi.fn(async () => "new-trial"),
	};

	await syncTrialReminderNotification(
		notifications,
		{
			body: "Body",
			key: `trial-ending:${reminderAt}`,
			title: "Title",
			triggerAt: new Date(reminderAt),
		},
		"clerk_user_1",
	);

	expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(
		1,
	);
	expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
		"old-trial",
	);
	expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
		content: {
			body: "Body",
			data: {
				dayovaOwnerId: "clerk_user_1",
				dayovaTrialReminderKey: `trial-ending:${reminderAt}`,
			},
			title: "Title",
		},
		trigger: {
			channelId: "dayova-reminders",
			date: new Date(reminderAt),
			type: "date",
		},
	});
});
