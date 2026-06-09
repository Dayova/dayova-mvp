/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	tokenIdentifier: "test:user",
};

test("notification preferences default to the MVP reminder settings", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const preferences = await t.query(api.notifications.getPreferences, {});

	expect(preferences).toEqual({
		systemNotificationsEnabled: true,
		dailyBriefingEnabled: true,
		dailyBriefingTime: "07:30",
		beforeExamEnabled: true,
		beforeLearningTimeEnabled: true,
		beforeHomeworkWorkEnabled: true,
		beforeHomeworkDueEnabled: true,
		reminderOffsetMinutes: 15,
		forgottenEventEnabled: true,
	});
});

test("notification preferences persist per user", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.notifications.updatePreferences, {
		systemNotificationsEnabled: false,
		dailyBriefingTime: "08:15",
		reminderOffsetMinutes: 30,
		beforeHomeworkDueEnabled: false,
	});

	await expect(t.query(api.notifications.getPreferences, {})).resolves.toEqual({
		systemNotificationsEnabled: false,
		dailyBriefingEnabled: true,
		dailyBriefingTime: "08:15",
		beforeExamEnabled: true,
		beforeLearningTimeEnabled: true,
		beforeHomeworkWorkEnabled: true,
		beforeHomeworkDueEnabled: false,
		reminderOffsetMinutes: 30,
		forgottenEventEnabled: true,
	});
});

test("due entry reminders create one unread in-app notification", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});

	await expect(
		t.mutation(api.notifications.syncDueNotifications, {
			now: "2026-06-16T15:45:00.000Z",
			localDayKey: "2026-06-16",
			localMinutes: 15 * 60 + 45,
		}),
	).resolves.toEqual({ created: 1 });
	await expect(
		t.mutation(api.notifications.syncDueNotifications, {
			now: "2026-06-16T15:46:00.000Z",
			localDayKey: "2026-06-16",
			localMinutes: 15 * 60 + 46,
		}),
	).resolves.toEqual({ created: 0 });

	const inbox = await t.query(api.notifications.listInbox, { category: "all" });
	expect(inbox).toMatchObject([
		{
			category: "task",
			type: "beforeEvent",
			title: "Hausaufgabe",
			body: "Deine Mathe Hausaufgabe startet in 15 Minuten.",
			readAt: null,
			deletedAt: null,
		},
	]);
});

test("changing reminder offset does not duplicate an already-created before-event notification", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});

	await expect(
		t.mutation(api.notifications.syncDueNotifications, {
			now: "2026-06-16T15:45:00.000Z",
			localDayKey: "2026-06-16",
			localMinutes: 15 * 60 + 45,
		}),
	).resolves.toEqual({ created: 1 });

	await t.mutation(api.notifications.updatePreferences, {
		reminderOffsetMinutes: 30,
	});

	await expect(
		t.mutation(api.notifications.syncDueNotifications, {
			now: "2026-06-16T15:46:00.000Z",
			localDayKey: "2026-06-16",
			localMinutes: 15 * 60 + 46,
		}),
	).resolves.toEqual({ created: 0 });

	const inbox = await t.query(api.notifications.listInbox, { category: "all" });
	expect(inbox).toHaveLength(1);
	expect(inbox[0]).toMatchObject({
		type: "beforeEvent",
		body: "Deine Mathe Hausaufgabe startet in 15 Minuten.",
	});
});

test("forgotten event notifications are created only for incomplete entries", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});
	const completedEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Deutsch Hausaufgabe",
		time: "17:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});
	await t.mutation(api.dayEntries.setCompleted, {
		id: completedEntryId,
		completed: true,
	});

	await expect(
		t.mutation(api.notifications.syncDueNotifications, {
			now: "2026-06-16T17:00:00.000Z",
			localDayKey: "2026-06-16",
			localMinutes: 17 * 60,
		}),
	).resolves.toEqual({ created: 1 });

	const inbox = await t.query(api.notifications.listInbox, {
		category: "task",
	});
	expect(inbox).toMatchObject([
		{
			category: "task",
			type: "forgottenEvent",
			title: "Hausaufgabe nicht vergessen",
			body: "Du kannst deine Mathe Hausaufgabe noch als erledigt markieren.",
		},
	]);
});

test("inbox notifications can be marked read and deleted", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});
	await t.mutation(api.notifications.syncDueNotifications, {
		now: "2026-06-16T15:45:00.000Z",
		localDayKey: "2026-06-16",
		localMinutes: 15 * 60 + 45,
	});

	let unread = await t.query(api.notifications.getUnreadSummary, {});
	expect(unread).toEqual({ hasUnread: true, unreadCount: 1 });

	await t.mutation(api.notifications.markAllRead, {
		now: "2026-06-16T15:46:00.000Z",
	});
	unread = await t.query(api.notifications.getUnreadSummary, {});
	expect(unread).toEqual({ hasUnread: false, unreadCount: 0 });

	const [notification] = await t.query(api.notifications.listInbox, {
		category: "all",
	});
	if (!notification) throw new Error("Expected notification.");
	await t.mutation(api.notifications.deleteNotification, {
		id: notification.id,
		now: "2026-06-16T15:47:00.000Z",
	});

	await expect(
		t.query(api.notifications.listInbox, { category: "all" }),
	).resolves.toEqual([]);
});

test("daily briefing summarizes today's entries at the configured time", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});
	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Englisch Test",
		time: "10:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});

	await expect(
		t.mutation(api.notifications.syncDueNotifications, {
			now: "2026-06-16T07:30:00.000Z",
			localDayKey: "2026-06-16",
			localMinutes: 7 * 60 + 30,
		}),
	).resolves.toEqual({ created: 1 });

	const inbox = await t.query(api.notifications.listInbox, { category: "all" });
	expect(inbox).toMatchObject([
		{
			category: "message",
			type: "dailyBriefing",
			title: "Tagesüberblick",
			body: "Heute stehen 2 Einträge an: Englisch Test um 10:00, Mathe Hausaufgabe um 16:00.",
		},
	]);
});

test("daily briefing uses singular wording for one entry", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Deutsch Hausaufgabe",
		time: "17:14",
		kind: "Hausaufgabe",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});

	await expect(
		t.mutation(api.notifications.syncDueNotifications, {
			now: "2026-06-16T07:30:00.000Z",
			localDayKey: "2026-06-16",
			localMinutes: 7 * 60 + 30,
		}),
	).resolves.toEqual({ created: 1 });

	const inbox = await t.query(api.notifications.listInbox, {
		category: "all",
	});
	expect(inbox).toMatchObject([
		{
			category: "message",
			type: "dailyBriefing",
			title: "Tagesüberblick",
			body: "Heute steht 1 Eintrag an: Deutsch Hausaufgabe um 17:14.",
		},
	]);
});
