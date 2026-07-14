import type * as ExpoNotifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export type NotificationPermissionStatus =
	| "checking"
	| "granted"
	| "denied"
	| "unavailable";

export const getNotificationsModule = () => {
	try {
		return require("expo-notifications") as typeof ExpoNotifications;
	} catch {
		return null;
	}
};

export const hasNotificationPermission = (
	notifications: typeof ExpoNotifications,
	permissions: ExpoNotifications.NotificationPermissionsStatus,
) =>
	permissions.granted ||
	permissions.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;

export const getNotificationPermissionStatus = (
	notifications: typeof ExpoNotifications,
	permissions: ExpoNotifications.NotificationPermissionsStatus,
): NotificationPermissionStatus =>
	hasNotificationPermission(notifications, permissions) ? "granted" : "denied";

export function useNotificationPermissionStatus() {
	const [notificationPermissionStatus, setNotificationPermissionStatus] =
		useState<NotificationPermissionStatus>("checking");

	useFocusEffect(
		useCallback(() => {
			const notifications = getNotificationsModule();
			if (!notifications) {
				setNotificationPermissionStatus("unavailable");
				return;
			}

			let isMounted = true;
			setNotificationPermissionStatus("checking");
			void notifications
				.getPermissionsAsync()
				.then((permissions) => {
					if (!isMounted) return;
					setNotificationPermissionStatus(
						getNotificationPermissionStatus(notifications, permissions),
					);
				})
				.catch(() => {
					if (!isMounted) return;
					setNotificationPermissionStatus("unavailable");
				});

			return () => {
				isMounted = false;
			};
		}, []),
	);

	return {
		notificationPermissionStatus,
		setNotificationPermissionStatus,
	};
}
