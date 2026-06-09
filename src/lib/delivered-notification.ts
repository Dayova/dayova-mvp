type DeliveredNotificationCategory = "learningPlan" | "task" | "message";

type DeliveredNotificationType =
	| "dailyBriefing"
	| "beforeEvent"
	| "forgottenEvent";

export type DeliveredNotificationInput = {
	eventKey: string;
	category: DeliveredNotificationCategory;
	type: DeliveredNotificationType;
	title: string;
	body: string;
	relatedDayEntryId?: string;
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

const isCategory = (value: unknown): value is DeliveredNotificationCategory =>
	value === "learningPlan" || value === "task" || value === "message";

const isType = (value: unknown): value is DeliveredNotificationType =>
	value === "dailyBriefing" ||
	value === "beforeEvent" ||
	value === "forgottenEvent";

const hasMatchingEventKey = (
	eventKey: string,
	type: DeliveredNotificationType,
) => {
	if (type === "dailyBriefing") return eventKey.startsWith("briefing:");
	if (type === "beforeEvent") return eventKey.startsWith("before:");
	return eventKey.startsWith("forgotten:");
};

const hasMatchingCategory = (
	category: DeliveredNotificationCategory,
	type: DeliveredNotificationType,
) =>
	type === "dailyBriefing"
		? category === "message"
		: category === "learningPlan" || category === "task";

export const getDeliveredNotificationInput = (
	notification: NotificationLike,
	expectedOwnerId?: string,
): DeliveredNotificationInput | null => {
	const data = notification.request.content.data;
	if (!isRecord(data)) return null;

	const eventKey = data.dayovaNotificationKey;
	const ownerId = data.dayovaOwnerId;
	const { category, type } = data;
	const { title, body } = notification.request.content;
	if (
		typeof eventKey !== "string" ||
		!isCategory(category) ||
		!isType(type) ||
		typeof title !== "string" ||
		typeof body !== "string" ||
		!hasMatchingEventKey(eventKey, type) ||
		!hasMatchingCategory(category, type)
	) {
		return null;
	}
	if (
		expectedOwnerId &&
		typeof ownerId === "string" &&
		ownerId !== expectedOwnerId
	) {
		return null;
	}

	const triggeredAt = new Date(notification.date);
	if (!Number.isFinite(triggeredAt.getTime())) return null;

	const relatedDayEntryId =
		typeof data.relatedEntryId === "string" ? data.relatedEntryId : undefined;

	return {
		eventKey,
		category,
		type,
		title,
		body,
		...(relatedDayEntryId ? { relatedDayEntryId } : {}),
		triggeredAt: triggeredAt.toISOString(),
	};
};
