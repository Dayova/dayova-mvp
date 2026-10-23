import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type * as ExpoNotifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { useLearningQuery } from "~/hooks/use-learning-query";
import { addDays, getDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { getDeliveredNotificationInput } from "~/lib/delivered-notification";
import { logDiagnosticError } from "~/lib/diagnostics";
import {
	DAYOVA_NOTIFICATION_CHANNEL_ID,
	syncPlannedLocalNotifications,
} from "~/lib/local-notification-scheduler";
import {
	getNotificationsModule,
	hasNotificationPermission,
} from "~/lib/notification-permissions";
import {
	buildLocalNotificationPlan,
	buildLocalNotificationRegistrationInput,
	type NotificationPlanningPreferences,
} from "~/lib/notification-planner";
import type { DayEntry } from "~/types/dayEntries";

const SCHEDULE_DAYS = 14;

const getLocalMinutes = (date: Date) =>
	date.getHours() * 60 + date.getMinutes();

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
	const { access } = useAccess();
	const { user, isSessionLoading } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const recordDeliveredNotification = useMutation(
		api.notifications.recordDeliveredNotification,
	);
	const registerLocalNotificationPlan = useMutation(
		api.notifications.registerLocalNotificationPlan,
	);
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
	const entriesByDay = (useLearningQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated && access?.canUseApp
			? { dayKeys, cacheScope: "notificationPlanning" }
			: "skip",
	) ?? null) as Record<string, DayEntry[]> | null;
	const latestSyncKeyRef = useRef<string | null>(null);
	const localSyncRef = useRef<Promise<unknown>>(Promise.resolve());
	const syncLocalNotifications = useCallback(
		(...args: Parameters<typeof syncPlannedLocalNotifications>) => {
			// Finish an in-flight native write before applying a newer plan or denial.
			const request = localSyncRef.current
				.catch(() => {})
				.then(() => syncPlannedLocalNotifications(...args));
			localSyncRef.current = request;
			return request;
		},
		[],
	);
	const isAccessDenied = access?.canUseApp === false;
	const recordSystemNotification = useCallback(
		async (notification: ExpoNotifications.Notification) => {
			if (!user || !isConvexAuthenticated) return;
			const deliveredNotification = getDeliveredNotificationInput(
				notification,
				user.clerkId,
			);
			if (!deliveredNotification) return;

			await recordDeliveredNotification({
				registrationId:
					deliveredNotification.registrationId as Id<"localNotificationSchedules">,
				triggeredAt: deliveredNotification.triggeredAt,
			});
		},
		[isConvexAuthenticated, recordDeliveredNotification, user],
	);

	const recordSystemNotificationSafely = useCallback(
		(notification: ExpoNotifications.Notification) => {
			void recordSystemNotification(notification).catch((error: unknown) => {
				logDiagnosticError(
					"Failed to record delivered system notification.",
					error,
					{
						source: "notifications.recordDelivered",
						level: "warn",
					},
				);
			});
		},
		[recordSystemNotification],
	);

	const reconcilePresentedNotifications = useCallback(
		async (notifications: typeof ExpoNotifications) => {
			const presented = await notifications.getPresentedNotificationsAsync();
			await Promise.all(presented.map(recordSystemNotification));

			const lastResponse = notifications.getLastNotificationResponse();
			if (lastResponse) {
				await recordSystemNotification(lastResponse.notification);
			}
		},
		[recordSystemNotification],
	);

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

		const receivedSubscription = notifications.addNotificationReceivedListener(
			recordSystemNotificationSafely,
		);
		const responseSubscription =
			notifications.addNotificationResponseReceivedListener((response) => {
				recordSystemNotificationSafely(response.notification);
				router.push("/notifications");
			});
		void reconcilePresentedNotifications(notifications).catch(
			(error: unknown) => {
				logDiagnosticError(
					"Failed to reconcile presented system notifications.",
					error,
					{
						source: "notifications.reconcilePresented",
						level: "warn",
					},
				);
			},
		);

		return () => {
			receivedSubscription.remove();
			responseSubscription.remove();
		};
	}, [reconcilePresentedNotifications, recordSystemNotificationSafely, router]);

	useEffect(() => {
		if (!isAccessDenied && (isSessionLoading || user)) return;
		latestSyncKeyRef.current = null;
		const notifications = getNotificationsModule();
		if (!notifications) return;

		void syncLocalNotifications(notifications, []).catch((error: unknown) => {
			logDiagnosticError(
				"Failed to clear ineligible scheduled notifications.",
				error,
				{
					source: "notifications.clearIneligible",
					level: "warn",
				},
			);
		});
	}, [isAccessDenied, isSessionLoading, syncLocalNotifications, user]);

	useEffect(() => {
		if (
			!access?.canUseApp ||
			!user ||
			!isConvexAuthenticated ||
			!preferences ||
			!entriesByDay
		) {
			return;
		}

		let cancelled = false;
		const syncNotifications = async () => {
			const now = new Date();
			const localDayKey = getDayKey(now);
			const localMinutes = getLocalMinutes(now);
			await syncDueNotifications({
				now: now.toISOString(),
				localDayKey,
				localMinutes,
			});
			if (cancelled) return;

			const notifications = getNotificationsModule();
			if (!notifications) return;
			await reconcilePresentedNotifications(notifications);

			const permissions = await notifications.getPermissionsAsync();
			if (cancelled) return;
			const canScheduleSystemNotifications =
				preferences.systemNotificationsEnabled &&
				hasNotificationPermission(notifications, permissions);

			if (!canScheduleSystemNotifications) {
				await syncLocalNotifications(notifications, []);
				return;
			}

			await ensureNotificationChannel(notifications);
			const plan = buildLocalNotificationPlan({
				now,
				preferences,
				entriesByDay,
			});
			const registrations = await registerLocalNotificationPlan(
				buildLocalNotificationRegistrationInput(plan),
			);
			if (cancelled) return;
			const registrationBySchedule = new Map(
				registrations.map((registration) => [
					`${registration.eventKey}\0${registration.scheduledFor}`,
					registration.registrationId,
				]),
			);
			const registeredPlan = plan.map((notification) => {
				const registrationId = registrationBySchedule.get(
					`${notification.key}\0${notification.triggerAt.getTime()}`,
				);
				if (!registrationId) {
					throw new Error("Missing local notification registration.");
				}
				return { ...notification, registrationId };
			});
			await syncLocalNotifications(notifications, registeredPlan, user.clerkId);
		};

		const syncKey = JSON.stringify({
			preferences,
			entriesByDay,
			dayKeys,
			ownerId: user.clerkId,
		});
		let syncCompleted = latestSyncKeyRef.current === syncKey;
		const reportSyncFailure = (error: unknown) => {
			logDiagnosticError("Failed to sync local notifications.", error, {
				source: "notifications.syncLocalPlan",
				level: "warn",
			});
		};
		if (!syncCompleted) {
			latestSyncKeyRef.current = syncKey;
			void syncNotifications().then(() => {
				if (!cancelled) syncCompleted = true;
			}, reportSyncFailure);
		}

		const subscription = AppState.addEventListener("change", (state) => {
			if (state !== "active") return;
			void syncNotifications().catch(reportSyncFailure);
		});

		return () => {
			cancelled = true;
			// An interrupted verification/registration must not suppress the next plan.
			if (!syncCompleted && latestSyncKeyRef.current === syncKey) {
				latestSyncKeyRef.current = null;
			}
			subscription.remove();
		};
	}, [
		access?.canUseApp,
		dayKeys,
		entriesByDay,
		isConvexAuthenticated,
		preferences,
		reconcilePresentedNotifications,
		registerLocalNotificationPlan,
		syncDueNotifications,
		syncLocalNotifications,
		user,
	]);

	return null;
}
