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
	dateUnit: "milliseconds" | "seconds" = "milliseconds",
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

	// Expo's iOS NotificationRecord emits seconds; Android emits milliseconds.
	const triggeredAt = new Date(
		dateUnit === "seconds" ? notification.date * 1000 : notification.date,
	);
	if (!Number.isFinite(triggeredAt.getTime())) return null;

	return {
		registrationId,
		triggeredAt: triggeredAt.toISOString(),
	};
};
