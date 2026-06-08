import type { PlannedLocalNotification } from "./notification-planner";

export const DAYOVA_NOTIFICATION_CHANNEL_ID = "dayova-reminders";
export const DAYOVA_NOTIFICATION_KEY = "dayovaNotificationKey";

type ScheduledNotificationRequest = {
	identifier: string;
	content: {
		data?: unknown;
	};
};

type LocalNotificationsModule = {
	SchedulableTriggerInputTypes: {
		DATE: unknown;
	};
	getAllScheduledNotificationsAsync: () => Promise<
		ScheduledNotificationRequest[]
	>;
	cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
	scheduleNotificationAsync: (request: {
		content: {
			title: string;
			body: string;
			data: Record<string, string>;
		};
		trigger: {
			type: unknown;
			date: Date;
			channelId: string;
		};
	}) => Promise<string>;
};

const getDataRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const isDayovaScheduledNotification = (
	request: ScheduledNotificationRequest,
) => typeof getDataRecord(request.content.data)[DAYOVA_NOTIFICATION_KEY] === "string";

export const syncPlannedLocalNotifications = async (
	notifications: LocalNotificationsModule,
	plan: PlannedLocalNotification[],
) => {
	const scheduled = await notifications.getAllScheduledNotificationsAsync();
	let cancelled = 0;
	for (const request of scheduled) {
		if (!isDayovaScheduledNotification(request)) continue;
		await notifications.cancelScheduledNotificationAsync(request.identifier);
		cancelled += 1;
	}

	let scheduledCount = 0;
	for (const notification of plan) {
		await notifications.scheduleNotificationAsync({
			content: {
				title: notification.title,
				body: notification.body,
				data: {
					[DAYOVA_NOTIFICATION_KEY]: notification.key,
					type: notification.type,
					category: notification.category,
					...(notification.relatedEntryId
						? { relatedEntryId: notification.relatedEntryId }
						: {}),
				},
			},
			trigger: {
				type: notifications.SchedulableTriggerInputTypes.DATE,
				date: notification.triggerAt,
				channelId: DAYOVA_NOTIFICATION_CHANNEL_ID,
			},
		});
		scheduledCount += 1;
	}

	return {
		cancelled,
		scheduled: scheduledCount,
	};
};
