export type DeliveredNotificationInput = {
	registrationId: string;
	triggeredAt: string;
};

type NotificationLike = {
	date: number;
	request: {
		content: {
			title?: string | null;
			body?: string | null;
			data?: unknown;
		};
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

export const getDeliveredNotificationInput = (
	notification: NotificationLike,
	expectedOwnerId?: string,
): DeliveredNotificationInput | null => {
	const data = notification.request.content.data;
	if (!isRecord(data)) return null;

	const eventKey = data.dayovaNotificationKey;
	const ownerId = data.dayovaOwnerId;
	const registrationId = data.dayovaNotificationRegistrationId;
	if (
		typeof eventKey !== "string" ||
		typeof registrationId !== "string" ||
		(expectedOwnerId !== undefined && ownerId !== expectedOwnerId)
	) {
		return null;
	}

	// Expo iOS 57 sends Unix seconds; Android and earlier clients use milliseconds.
	// Normalize both native representations before validating against the schedule.
	const timestamp =
		notification.date > 0 && notification.date < 1_000_000_000_000
			? notification.date * 1000
			: notification.date;
	const triggeredAt = new Date(timestamp);
	if (!Number.isFinite(triggeredAt.getTime())) return null;

	return {
		registrationId,
		triggeredAt: triggeredAt.toISOString(),
	};
};
