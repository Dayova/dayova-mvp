import { DAYOVA_NOTIFICATION_CHANNEL_ID } from "./local-notification-scheduler";

const TRIAL_REMINDER_DATA_KEY = "dayovaTrialReminderKey";
const OWNER_DATA_KEY = "dayovaOwnerId";

type TrialReminderAccess = {
	state: "needsActivation" | "trial" | "paid" | "billingGrace" | "expired";
	reminderAt?: number;
	trialExpiresAt?: number;
};

export type PlannedTrialReminder = {
	body: string;
	key: string;
	title: string;
	triggerAt: Date;
};

type ScheduledNotificationRequest = {
	identifier: string;
	content: {
		data?: unknown;
	};
};

type TrialNotificationsModule = {
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

export const buildTrialReminder = ({
	access,
	now,
}: {
	access: TrialReminderAccess;
	now: number;
}): PlannedTrialReminder | null => {
	if (
		access.state !== "trial" ||
		access.reminderAt === undefined ||
		access.trialExpiresAt === undefined ||
		access.reminderAt <= now ||
		access.reminderAt >= access.trialExpiresAt
	) {
		return null;
	}

	return {
		body: "Deine kostenlose Testphase endet in 2 Tagen. Danach entscheidest du selbst, wie es weitergeht.",
		key: `trial-ending:${access.reminderAt}`,
		title: "Deine Testphase endet bald",
		triggerAt: new Date(access.reminderAt),
	};
};

export const syncTrialReminderNotification = async (
	notifications: TrialNotificationsModule,
	reminder: PlannedTrialReminder | null,
	ownerId?: string,
) => {
	const scheduled = await notifications.getAllScheduledNotificationsAsync();
	for (const request of scheduled) {
		const data = getDataRecord(request.content.data);
		if (typeof data[TRIAL_REMINDER_DATA_KEY] !== "string") continue;
		await notifications.cancelScheduledNotificationAsync(request.identifier);
	}

	if (!reminder) return { scheduled: false };

	await notifications.scheduleNotificationAsync({
		content: {
			title: reminder.title,
			body: reminder.body,
			data: {
				[TRIAL_REMINDER_DATA_KEY]: reminder.key,
				...(ownerId ? { [OWNER_DATA_KEY]: ownerId } : {}),
			},
		},
		trigger: {
			type: notifications.SchedulableTriggerInputTypes.DATE,
			date: reminder.triggerAt,
			channelId: DAYOVA_NOTIFICATION_CHANNEL_ID,
		},
	});

	return { scheduled: true };
};
