import { useConvexAuth, useQuery } from "convex/react";
import type * as ExpoNotifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { api } from "#convex/_generated/api";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { logDiagnosticError } from "~/lib/diagnostics";
import { DAYOVA_NOTIFICATION_CHANNEL_ID } from "~/lib/local-notification-scheduler";
import type { NotificationPlanningPreferences } from "~/lib/notification-planner";
import {
	buildTrialReminder,
	syncTrialReminderNotification,
} from "~/lib/trial-reminder";

const getNotificationsModule = () => {
	try {
		return require("expo-notifications") as typeof ExpoNotifications;
	} catch {
		return null;
	}
};

const hasNotificationPermission = (
	notifications: typeof ExpoNotifications,
	permissions: ExpoNotifications.NotificationPermissionsStatus,
) =>
	permissions.granted ||
	permissions.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;

export function TrialReminderSync() {
	const { access } = useAccess();
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const preferences = useQuery(
		api.notifications.getPreferences,
		user && isConvexAuthenticated ? {} : "skip",
	) as NotificationPlanningPreferences | undefined;
	const preferencesLoaded = preferences !== undefined;
	const systemNotificationsEnabled = preferences?.systemNotificationsEnabled;
	const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

	useEffect(() => {
		const notifications = getNotificationsModule();
		if (!notifications) return;

		const syncReminder = async () => {
			if (!user || !access) {
				await syncTrialReminderNotification(notifications, null);
				return;
			}
			if (!preferencesLoaded) return;
			if (!systemNotificationsEnabled) {
				await syncTrialReminderNotification(notifications, null);
				return;
			}

			const permissions = await notifications.getPermissionsAsync();
			if (!hasNotificationPermission(notifications, permissions)) {
				await syncTrialReminderNotification(notifications, null);
				return;
			}

			if (Platform.OS === "android") {
				await notifications.setNotificationChannelAsync(
					DAYOVA_NOTIFICATION_CHANNEL_ID,
					{
						name: "Dayova Erinnerungen",
						importance: notifications.AndroidImportance.DEFAULT,
					},
				);
			}

			const reminder = buildTrialReminder({
				access,
				now: Date.now(),
			});
			await syncTrialReminderNotification(
				notifications,
				reminder,
				user.clerkId,
			);
		};

		const nextSync = syncQueueRef.current
			.then(syncReminder, syncReminder)
			.catch((error: unknown) => {
				logDiagnosticError("Unable to sync the trial reminder.", error, {
					source: "access.trialReminder",
					level: "warn",
				});
			});
		syncQueueRef.current = nextSync;
	}, [access, preferencesLoaded, systemNotificationsEnabled, user]);

	return null;
}
