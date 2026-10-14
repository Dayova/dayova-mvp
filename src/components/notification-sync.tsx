import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type * as ExpoNotifications from "expo-notifications";
import {
	type Href,
	usePathname,
	useRootNavigationState,
	useRouter,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { getAuthNavigationTarget } from "~/lib/auth-routing";
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
	const {
		user,
		isSessionLoading,
		onboardingCompletionStatus,
		pendingSessionTask,
	} = useAuthSession();
	const rootNavigationState = useRootNavigationState();
	const pathname = usePathname();
	const { access, isAccessLoading } = useAccess();
	const authRedirect = getAuthNavigationTarget({
		hasUser: Boolean(user),
		isSessionLoading,
		onboardingCompletionStatus,
		pendingSessionTask,
		pathname,
	});
	const canOpen = Boolean(
		rootNavigationState?.key &&
			!authRedirect &&
			!isAccessLoading &&
			access?.canUseApp &&
			!isSessionLoading &&
			onboardingCompletionStatus === "none" &&
			!pendingSessionTask,
	);
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const openNotification = useMutation(api.notifications.openNotification);
	const handledResponseRef = useRef<string | null>(null);
	const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
	const enqueueSync = useCallback((sync: () => Promise<unknown>) => {
		syncQueueRef.current = syncQueueRef.current
			.then(sync, sync)
			.then(() => undefined)
			.catch((error: unknown) => {
				logDiagnosticError("Failed to synchronize notifications.", error, {
					source: "notifications.sync",
					level: "warn",
				});
			});
	}, []);
	const openSystemNotification = useCallback(
		async (response: ExpoNotifications.NotificationResponse) => {
			if (!user || !isConvexAuthenticated || !canOpen) return;
			const input = getDeliveredNotificationInput(
				response.notification,
				user.clerkId,
			);
			const data = response.notification.request.content.data;
			const isTrialReminder =
				data?.dayovaOwnerId === user.clerkId &&
				typeof data.dayovaTrialReminderKey === "string";
			if (!input && !isTrialReminder) return;
			const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
			if (handledResponseRef.current === key) return;
			handledResponseRef.current = key;
			try {
				const href = input
					? await openNotification({
							registrationId:
								input.registrationId as Id<"localNotificationSchedules">,
						})
					: "/subscription";
				await getNotificationsModule()?.clearLastNotificationResponseAsync();
				router.push(href as Href);
			} catch (error) {
				handledResponseRef.current = null;
				logDiagnosticError("Failed to open notification.", error, {
					source: "notifications.open",
					level: "warn",
				});
			}
		},
		[user, isConvexAuthenticated, canOpen, openNotification, router],
	);
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
	const entriesByDay = (useQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated ? { dayKeys } : "skip",
	) ?? null) as Record<string, DayEntry[]> | null;

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
				void openSystemNotification(response);
			});
		const lastResponse = notifications.getLastNotificationResponse();
		if (lastResponse) void openSystemNotification(lastResponse);
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
	}, [
		reconcilePresentedNotifications,
		recordSystemNotificationSafely,
		openSystemNotification,
	]);

	useEffect(() => {
		if (isSessionLoading || user) return;
		const notifications = getNotificationsModule();
		if (!notifications) return;

		enqueueSync(() =>
			syncPlannedLocalNotifications(notifications, []).catch(
				(error: unknown) => {
					logDiagnosticError(
						"Failed to clear scheduled notifications after logout.",
						error,
						{
							source: "notifications.clearAfterLogout",
							level: "warn",
						},
					);
				},
			),
		);
	}, [isSessionLoading, user, enqueueSync]);

	useEffect(() => {
		if (!user || !isConvexAuthenticated || !preferences || !entriesByDay) {
			return;
		}

		let cancelled = false;
		const syncNotifications = async () => {
			if (cancelled) return;
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
			await reconcilePresentedNotifications(notifications);

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
			}).slice(0, 60);
			const registrations = await registerLocalNotificationPlan(
				buildLocalNotificationRegistrationInput(plan),
			);
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
			await syncPlannedLocalNotifications(
				notifications,
				registeredPlan,
				user.clerkId,
			);
		};

		enqueueSync(syncNotifications);

		const subscription = AppState.addEventListener("change", (state) => {
			if (state !== "active") return;
			enqueueSync(syncNotifications);
		});

		return () => {
			cancelled = true;
			subscription.remove();
		};
	}, [
		enqueueSync,
		entriesByDay,
		isConvexAuthenticated,
		preferences,
		reconcilePresentedNotifications,
		registerLocalNotificationPlan,
		syncDueNotifications,
		user,
	]);

	return null;
}
