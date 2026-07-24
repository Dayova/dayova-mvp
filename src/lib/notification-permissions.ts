import type * as ExpoNotifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

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
	const [notificationPermissionStatus, setPermissionStatusState] =
		useState<NotificationPermissionStatus>("checking");
	const requestVersionRef = useRef(0);
	const setNotificationPermissionStatus = useCallback(
		(status: NotificationPermissionStatus) => {
			requestVersionRef.current += 1;
			setPermissionStatusState(status);
		},
		[],
	);

	useFocusEffect(
		useCallback(() => {
			const notifications = getNotificationsModule();
			if (!notifications) {
				setPermissionStatusState("unavailable");
				return;
			}

			let isMounted = true;
			const requestVersion = requestVersionRef.current + 1;
			requestVersionRef.current = requestVersion;
			setPermissionStatusState("checking");
			void notifications
				.getPermissionsAsync()
				.then((permissions) => {
					if (!isMounted || requestVersionRef.current !== requestVersion)
						return;
					setPermissionStatusState(
						getNotificationPermissionStatus(notifications, permissions),
					);
				})
				.catch(() => {
					if (!isMounted || requestVersionRef.current !== requestVersion)
						return;
					setPermissionStatusState("unavailable");
				});

			return () => {
				isMounted = false;
				if (requestVersionRef.current === requestVersion) {
					requestVersionRef.current += 1;
				}
			};
		}, []),
	);

	return {
		notificationPermissionStatus,
		setNotificationPermissionStatus,
	};
}
