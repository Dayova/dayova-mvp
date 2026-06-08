import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type * as ExpoNotifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";
import { api } from "#convex/_generated/api";
import {
	DAYOVA_NOTIFICATION_CHANNEL_ID,
	syncPlannedLocalNotifications,
} from "~/lib/local-notification-scheduler";
import {
	buildLocalNotificationPlan,
	type NotificationPlanningPreferences,
} from "~/lib/notification-planner";
import { addDays, getDayKey, useCurrentLocalDay } from "~/lib/day-key";
import type { DayEntry } from "~/types/dayEntries";
import { useAuth } from "~/context/AuthContext";

const SCHEDULE_DAYS = 14;

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

const getLocalMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();

const ensureNotificationChannel = async (
	notifications: typeof ExpoNotifications,
) => {
	if (Platform.OS !== "android") return;

	await notifications.setNotificationChannelAsync(
		DAYOVA_NOTIFICATION_CHANNEL_ID,
		{
			name: "Dayova Erinnerungen",
			importance: notifications.AndroidImportance.DEFAULT,
		},
	);
};

export function NotificationSync() {
	const router = useRouter();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const syncDueNotifications = useMutation(
		api.notifications.syncDueNotifications,
	);
	const preferences = useQuery(
		api.notifications.getPreferences,
		user && isConvexAuthenticated ? {} : "skip",
	) as NotificationPlanningPreferences | undefined;
	const dayKeys = useMemo(
		() =>
			Array.from({ length: SCHEDULE_DAYS }, (_, index) =>
				getDayKey(addDays(today, index)),
			),
		[today],
	);
	const entriesByDay = (useQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated ? { dayKeys } : "skip",
	) ?? null) as Record<string, DayEntry[]> | null;
	const latestSyncKeyRef = useRef<string | null>(null);

	useEffect(() => {
		const notifications = getNotificationsModule();
		if (!notifications) return;

		notifications.setNotificationHandler({
			handleNotification: async () => ({
				shouldShowBanner: true,
				shouldShowList: true,
				shouldPlaySound: false,
				shouldSetBadge: false,
			}),
		});

		const subscription = notifications.addNotificationResponseReceivedListener(
			() => {
				router.push("/notifications");
			},
		);

		return () => subscription.remove();
	}, [router]);

	useEffect(() => {
		if (!user || !isConvexAuthenticated || !preferences || !entriesByDay) {
			return;
		}

		const syncNotifications = async () => {
			const now = new Date();
			const localDayKey = getDayKey(now);
			const localMinutes = getLocalMinutes(now);
			await syncDueNotifications({
				now: now.toISOString(),
				localDayKey,
				localMinutes,
			});

			const notifications = getNotificationsModule();
			if (!notifications) return;

			const permissions = await notifications.getPermissionsAsync();
			const canScheduleSystemNotifications =
				preferences.systemNotificationsEnabled &&
				hasNotificationPermission(notifications, permissions);

			if (!canScheduleSystemNotifications) {
				await syncPlannedLocalNotifications(notifications, []);
				return;
			}

			await ensureNotificationChannel(notifications);
			const plan = buildLocalNotificationPlan({
				now,
				preferences,
				entriesByDay,
			});
			await syncPlannedLocalNotifications(notifications, plan);
		};

		const syncKey = JSON.stringify({
			preferences,
			entriesByDay,
			dayKeys,
		});
		if (latestSyncKeyRef.current !== syncKey) {
			latestSyncKeyRef.current = syncKey;
			void syncNotifications();
		}

		const subscription = AppState.addEventListener("change", (state) => {
			if (state !== "active") return;
			void syncNotifications();
		});

		return () => subscription.remove();
	}, [
		dayKeys,
		entriesByDay,
		isConvexAuthenticated,
		preferences,
		syncDueNotifications,
		user,
	]);

	return null;
}
