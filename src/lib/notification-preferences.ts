import type { NotificationPlanningPreferences } from "./notification-planner";

export type NotificationPreferenceKey = keyof NotificationPlanningPreferences;

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
