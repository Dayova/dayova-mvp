import type { NotificationPermissionStatus } from "./notification-permissions";
import type { NotificationPlanningPreferences } from "./notification-planner";

export type NotificationPreferenceKey = keyof NotificationPlanningPreferences;

export type NotificationPreferenceControlState = {
	systemNotificationsDisabled: boolean;
	dailyBriefingDisabled: boolean;
	dailyBriefingTimeDisabled: boolean;
	beforeExamDisabled: boolean;
	beforeLearningTimeDisabled: boolean;
	beforeHomeworkWorkDisabled: boolean;
	beforeHomeworkDueDisabled: boolean;
	reminderOffsetDisabled: boolean;
	forgottenEventDisabled: boolean;
};

export type PushNotificationDeliveryStatus =
	| "active"
	| "disabled"
	| "checking"
	| "unavailable";

export type PushNotificationDeliveryState = {
	status: PushNotificationDeliveryStatus;
	showDisabledStatus: boolean;
};

const notificationPreferenceKeys: NotificationPreferenceKey[] = [
	"systemNotificationsEnabled",
	"dailyBriefingEnabled",
	"dailyBriefingTime",
	"beforeExamEnabled",
	"beforeLearningTimeEnabled",
	"beforeHomeworkWorkEnabled",
	"beforeHomeworkDueEnabled",
	"reminderOffsetMinutes",
	"forgottenEventEnabled",
];

const pushDeliveryStatusByPermission: Record<
	NotificationPermissionStatus,
	PushNotificationDeliveryState["status"]
> = {
	checking: "checking",
	granted: "active",
	denied: "disabled",
	unavailable: "unavailable",
};

export const getPushNotificationDeliveryState = ({
	preferenceEnabled,
	permissionStatus,
}: {
	preferenceEnabled: boolean;
	permissionStatus: NotificationPermissionStatus;
}): PushNotificationDeliveryState => {
	const status = preferenceEnabled
		? pushDeliveryStatusByPermission[permissionStatus]
		: "disabled";

	return {
		status,
		showDisabledStatus: status === "disabled",
	};
};

export const getNotificationPreferenceControlState = ({
	preferences,
	pendingKeys,
}: {
	preferences: NotificationPlanningPreferences | undefined;
	pendingKeys: NotificationPreferenceKey[];
}): NotificationPreferenceControlState => {
	const isDisabled = (key: NotificationPreferenceKey) =>
		preferences === undefined || pendingKeys.includes(key);

	return {
		systemNotificationsDisabled: isDisabled("systemNotificationsEnabled"),
		dailyBriefingDisabled: isDisabled("dailyBriefingEnabled"),
		dailyBriefingTimeDisabled: isDisabled("dailyBriefingTime"),
		beforeExamDisabled: isDisabled("beforeExamEnabled"),
		beforeLearningTimeDisabled: isDisabled("beforeLearningTimeEnabled"),
		beforeHomeworkWorkDisabled: isDisabled("beforeHomeworkWorkEnabled"),
		beforeHomeworkDueDisabled: isDisabled("beforeHomeworkDueEnabled"),
		reminderOffsetDisabled: isDisabled("reminderOffsetMinutes"),
		forgottenEventDisabled: isDisabled("forgottenEventEnabled"),
	};
};

export const getNotificationPreferencePatchKeys = (
	patch: Partial<NotificationPlanningPreferences>,
): NotificationPreferenceKey[] =>
	notificationPreferenceKeys.filter((key) => patch[key] !== undefined);

export const applyNotificationPreferencePatch = (
	preferences: NotificationPlanningPreferences,
	patch: Partial<NotificationPlanningPreferences>,
): NotificationPlanningPreferences => ({
	...preferences,
	...patch,
});

export const removeNotificationPreferencePatchKeys = (
	patch: Partial<NotificationPlanningPreferences>,
	keys: NotificationPreferenceKey[],
): Partial<NotificationPlanningPreferences> => {
	if (keys.length === 0) return patch;

	const nextPatch = { ...patch };
	let changed = false;
	for (const key of keys) {
		if (key in nextPatch) {
			delete nextPatch[key];
			changed = true;
		}
	}

	return changed ? nextPatch : patch;
};

export const clearConfirmedNotificationPreferencePatch = (
	patch: Partial<NotificationPlanningPreferences>,
	preferences: NotificationPlanningPreferences,
): Partial<NotificationPlanningPreferences> => {
	const confirmedKeys = getNotificationPreferencePatchKeys(patch).filter(
		(key) => preferences[key] === patch[key],
	);

	return removeNotificationPreferencePatchKeys(patch, confirmedKeys);
};
