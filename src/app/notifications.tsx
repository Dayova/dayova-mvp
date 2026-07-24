import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	TouchableOpacity,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Easing,
	FadeOut,
	interpolate,
	interpolateColor,
	LinearTransition,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { NotificationDeliveryInfoSheet } from "~/components/notification-delivery-info-sheet";
import { ScreenHeader as Header } from "~/components/screen-header";
import {
	BellOff,
	BookOpen,
	ClipboardList,
	Mail,
	Trash2,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { logDiagnosticError } from "~/lib/diagnostics";
import { goBackOrReplace } from "~/lib/navigation";
import { useNotificationPermissionStatus } from "~/lib/notification-permissions";
import type { NotificationPlanningPreferences } from "~/lib/notification-planner";
import { getPushNotificationDeliveryState } from "~/lib/notification-preferences";

type InboxCategory = "all" | "learningPlan" | "task";

type InboxNotification = {
	id: Id<"notificationHistory">;
	category: "learningPlan" | "task" | "message";
	type: "dailyBriefing" | "beforeEvent" | "forgottenEvent";
	title: string;
	body: string;
	triggeredAt: number;
	readAt: number | null;
	deletedAt: number | null;
};

const CATEGORIES: Array<{ key: InboxCategory; label: string }> = [
	{ key: "all", label: "Alle" },
	{ key: "learningPlan", label: "Lernpläne" },
	{ key: "task", label: "Aufgaben" },
];
const PRIMARY_INTERACTIVE_GRADIENT =
	DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const SWIPE_DELETE_MIN_DISTANCE = 96;
const SWIPE_DELETE_MAX_DISTANCE = 132;
const SWIPE_DELETE_FLING_DISTANCE = 40;
const SWIPE_DELETE_FLING_VELOCITY = -700;
const NOTIFICATION_EXIT = FadeOut.duration(90);
const NOTIFICATION_LAYOUT = LinearTransition.springify()
	.damping(20)
	.stiffness(180);

const formatRelativeTime = (timestamp: number) => {
	const diffMinutes = Math.max(
		1,
		Math.round((Date.now() - timestamp) / 60_000),
	);
	if (diffMinutes < 60) return `vor ${diffMinutes} min`;
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) return `vor ${diffHours} Std.`;
	const diffDays = Math.round(diffHours / 24);
	return `vor ${diffDays} Tg.`;
};

function NotificationIcon({
	category,
}: {
	category: InboxNotification["category"];
}) {
	if (category === "learningPlan") {
		return (
			<BookOpen
				size={22}
				color={DAYOVA_DESIGN_SYSTEM.colors.primary}
				strokeWidth={2}
			/>
		);
	}
	if (category === "task") {
		return (
			<ClipboardList
				size={22}
				color={DAYOVA_DESIGN_SYSTEM.colors.primary}
				strokeWidth={2}
			/>
		);
	}
	return (
		<Mail
			size={22}
			color={DAYOVA_DESIGN_SYSTEM.colors.primary}
			strokeWidth={2}
		/>
	);
}

function CategoryTabs({
	value,
	onChange,
}: {
	value: InboxCategory;
	onChange: (category: InboxCategory) => void;
}) {
	const selectedIndex = CATEGORIES.findIndex(
		(category) => category.key === value,
	);
	const indicatorWidth = useSharedValue(0);
	const selectionPosition = useSharedValue(selectedIndex);
	const indicatorStyle = useAnimatedStyle(() => ({
		width: indicatorWidth.get(),
		transform: [{ translateX: selectionPosition.get() * indicatorWidth.get() }],
	}));

	useEffect(() => {
		selectionPosition.set(
			withTiming(selectedIndex, {
				duration: 240,
				easing: Easing.out(Easing.cubic),
			}),
		);
	}, [selectedIndex, selectionPosition]);

	return (
		<View
			className="flex-row rounded-full bg-card"
			onLayout={({ nativeEvent }) => {
				const nextIndicatorWidth =
					(nativeEvent.layout.width - 8) / CATEGORIES.length;
				indicatorWidth.set(nextIndicatorWidth);
			}}
			style={{
				minHeight: 60,
				paddingHorizontal: 4,
				paddingVertical: 6,
				boxShadow: "0 6px 16px rgba(20, 28, 48, 0.06)",
			}}
		>
			<Animated.View
				pointerEvents="none"
				style={[
					{
						position: "absolute",
						left: 4,
						top: 6,
						height: 48,
						borderRadius: 999,
						overflow: "hidden",
					},
					indicatorStyle,
				]}
			>
				<LinearGradient
					colors={PRIMARY_INTERACTIVE_GRADIENT.colors}
					start={PRIMARY_INTERACTIVE_GRADIENT.start}
					end={PRIMARY_INTERACTIVE_GRADIENT.end}
					style={{ flex: 1 }}
				/>
			</Animated.View>
			{CATEGORIES.map((category, index) => {
				const selected = value === category.key;

				return (
					<TouchableOpacity
						key={category.key}
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						activeOpacity={0.84}
						onPress={() => onChange(category.key)}
						className="items-center justify-center rounded-full"
						style={{
							zIndex: 1,
							flexGrow: 1,
							flexBasis: 0,
							height: 48,
							minHeight: 48,
						}}
					>
						<CategoryTabLabel
							index={index}
							label={category.label}
							selectionPosition={selectionPosition}
						/>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

function CategoryTabLabel({
	index,
	label,
	selectionPosition,
}: {
	index: number;
	label: string;
	selectionPosition: SharedValue<number>;
}) {
	const animatedStyle = useAnimatedStyle(() => ({
		color: interpolateColor(
			Math.min(Math.abs(selectionPosition.get() - index), 1),
			[0, 1],
			["#FFFFFF", "#1A1A1A"],
		),
	}));

	return (
		<Animated.Text
			className="font-poppins font-semibold text-body-4"
			// Reanimated owns the interpolated tab text color.
			style={animatedStyle}
		>
			{label}
		</Animated.Text>
	);
}

function NotificationCard({
	notification,
	onDelete,
}: {
	notification: InboxNotification;
	onDelete: () => Promise<unknown>;
}) {
	const [isLocallyDeleted, setIsLocallyDeleted] = useState(false);
	const translateX = useSharedValue(0);
	const cardWidth = useSharedValue(1);
	const isDeleting = useSharedValue(false);
	const commitDelete = () => {
		setIsLocallyDeleted(true);
		void onDelete().catch(() => {
			translateX.set(0);
			isDeleting.set(false);
			setIsLocallyDeleted(false);
		});
	};

	const panGesture = Gesture.Pan()
		.activeOffsetX([-10, 10])
		.failOffsetY([-12, 12])
		.onUpdate((event) => {
			"worklet";
			if (isDeleting.get()) return;

			translateX.set(
				Math.max(Math.min(event.translationX, 0), -cardWidth.get()),
			);
		})
		.onEnd((event) => {
			"worklet";
			if (isDeleting.get()) return;

			const distance = -translateX.get();
			const deleteThreshold = Math.min(
				Math.max(cardWidth.get() * 0.3, SWIPE_DELETE_MIN_DISTANCE),
				SWIPE_DELETE_MAX_DISTANCE,
			);
			const shouldDelete =
				distance >= deleteThreshold ||
				(event.velocityX <= SWIPE_DELETE_FLING_VELOCITY &&
					distance >= SWIPE_DELETE_FLING_DISTANCE);

			if (!shouldDelete) return;

			isDeleting.set(true);
			translateX.set(
				withTiming(
					-cardWidth.get() - 24,
					{
						duration: 180,
						easing: Easing.out(Easing.cubic),
					},
					(finished) => {
						"worklet";
						if (finished) scheduleOnRN(commitDelete);
					},
				),
			);
		})
		.onFinalize(() => {
			"worklet";
			if (isDeleting.get()) return;

			translateX.set(
				withSpring(0, {
					damping: 20,
					mass: 0.7,
					overshootClamping: true,
					stiffness: 260,
				}),
			);
		});

	const cardAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.get() }],
	}));
	const deleteBackgroundAnimatedStyle = useAnimatedStyle(() => {
		const deleteThreshold = Math.min(
			Math.max(cardWidth.get() * 0.3, SWIPE_DELETE_MIN_DISTANCE),
			SWIPE_DELETE_MAX_DISTANCE,
		);
		const progress = Math.min(-translateX.get() / deleteThreshold, 1);

		return {
			backgroundColor: interpolateColor(
				progress,
				[0, 0.6, 1],
				["#FFB8B8", "#FF5A5F", "#E11D48"],
			),
		};
	});
	const deleteIconAnimatedStyle = useAnimatedStyle(() => {
		const deleteThreshold = Math.min(
			Math.max(cardWidth.get() * 0.3, SWIPE_DELETE_MIN_DISTANCE),
			SWIPE_DELETE_MAX_DISTANCE,
		);
		const progress = Math.min(-translateX.get() / deleteThreshold, 1);

		return {
			opacity: interpolate(progress, [0, 0.18, 1], [0, 1, 1], "clamp"),
			transform: [
				{
					translateX: interpolate(progress, [0, 1], [18, 0], "clamp"),
				},
				{
					scale: interpolate(
						progress,
						[0, 0.75, 1],
						[0.72, 0.95, 1.12],
						"clamp",
					),
				},
			],
		};
	});

	if (isLocallyDeleted) return null;

	return (
		<Animated.View
			className="my-1 rounded-[24px]"
			exiting={NOTIFICATION_EXIT}
			layout={NOTIFICATION_LAYOUT}
			style={{ boxShadow: "0 8px 18px rgba(20, 28, 48, 0.08)" }}
		>
			<Animated.View
				pointerEvents="none"
				className="absolute inset-0 items-end justify-center overflow-hidden rounded-[24px]"
				style={deleteBackgroundAnimatedStyle}
			>
				<Animated.View
					className="mr-5 h-[52px] w-[52px] items-center justify-center rounded-full bg-card/20"
					style={deleteIconAnimatedStyle}
				>
					<Trash2 size={27} color="#FFFFFF" strokeWidth={2.3} />
				</Animated.View>
			</Animated.View>
			<GestureDetector gesture={panGesture}>
				<Animated.View
					accessible
					accessibilityActions={[
						{ name: "delete", label: "Mitteilung löschen" },
					]}
					accessibilityHint="Zum Löschen nach links wischen"
					accessibilityLabel={`${notification.title}. ${notification.body}`}
					onAccessibilityAction={(event) => {
						if (event.nativeEvent.actionName === "delete") commitDelete();
					}}
					onLayout={({ nativeEvent }) => {
						cardWidth.set(nativeEvent.layout.width);
					}}
					className="flex-row gap-3 rounded-[24px] bg-card px-4 py-6"
					// Reanimated swipe offset is runtime state.
					style={cardAnimatedStyle}
				>
					<View className="h-10 w-10 items-center justify-center rounded-full bg-accent">
						<NotificationIcon category={notification.category} />
					</View>
					<View className="flex-1 gap-1">
						<View className="flex-row items-start justify-between gap-2">
							<Text
								className="flex-1 font-poppins font-semibold text-body-3 text-text"
								numberOfLines={1}
							>
								{notification.title}
							</Text>
							<View className="rounded-full bg-muted px-3 py-1">
								<Text className="font-poppins text-body-5 text-secondary-text">
									{formatRelativeTime(notification.triggeredAt)}
								</Text>
							</View>
						</View>
						<Text className="font-poppins text-body-4 text-secondary-text">
							{notification.body}
						</Text>
					</View>
				</Animated.View>
			</GestureDetector>
		</Animated.View>
	);
}

export default function NotificationsScreen() {
	const router = useRouter();
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const [category, setCategory] = useState<InboxCategory>("all");
	const { notificationPermissionStatus } = useNotificationPermissionStatus();
	const [showDeliveryInfo, setShowDeliveryInfo] = useState(false);
	const preferences = useQuery(
		api.notifications.getPreferences,
		user && isConvexAuthenticated ? {} : "skip",
	) as NotificationPlanningPreferences | undefined;
	const inbox = (useQuery(
		api.notifications.listInbox,
		user && isConvexAuthenticated ? { category } : "skip",
	) ?? null) as InboxNotification[] | null;
	const markAllRead = useMutation(api.notifications.markAllRead);
	const deleteNotification = useMutation(api.notifications.deleteNotification);

	useEffect(() => {
		if (!user || !isConvexAuthenticated) return;
		void markAllRead({ now: new Date().toISOString() });
	}, [isConvexAuthenticated, markAllRead, user]);

	const pushDeliveryState = getPushNotificationDeliveryState({
		preferenceEnabled: preferences?.systemNotificationsEnabled ?? true,
		permissionStatus: notificationPermissionStatus,
	});
	const openPushSettings = () => {
		setShowDeliveryInfo(false);
		if (!preferences?.systemNotificationsEnabled) {
			router.push("/notification-settings");
			return;
		}
		void Linking.openSettings().catch((error: unknown) => {
			logDiagnosticError(
				"Failed to open notification system settings.",
				error,
				{
					source: "notifications.openSystemSettings",
					level: "warn",
				},
			);
			setShowDeliveryInfo(true);
		});
	};
	const pushAction = preferences?.systemNotificationsEnabled
		? {
				label: "Systemeinstellungen öffnen",
				onPress: openPushSettings,
			}
		: {
				label: "Zu den Einstellungen",
				onPress: openPushSettings,
			};
	const openDeliveryInfo = () => setShowDeliveryInfo(true);
	const closeDeliveryInfo = () => setShowDeliveryInfo(false);
	const goBack = () => goBackOrReplace(router, "/home");
	const visibleInbox = useMemo(() => inbox ?? [], [inbox]);

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={72} bottomPadding={120} horizontalPadding={24}>
				<Header title="Mitteilungen" onBack={goBack} className="mb-7" />
				<View className="gap-5">
					<CategoryTabs value={category} onChange={setCategory} />
					{pushDeliveryState.showDisabledStatus ? (
						<TouchableOpacity
							accessibilityLabel="Push-Mitteilungen sind aus. Details öffnen"
							accessibilityRole="button"
							activeOpacity={0.72}
							className="flex-row items-center gap-2 self-start rounded-full bg-muted px-4 py-2.5"
							onPress={openDeliveryInfo}
						>
							<BellOff
								size={17}
								color={DAYOVA_DESIGN_SYSTEM.colors.secondaryText}
								strokeWidth={2.2}
							/>
							<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
								Push aus
							</Text>
						</TouchableOpacity>
					) : null}

					{inbox === null ? (
						<View className="items-center py-10">
							<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
						</View>
					) : null}

					{inbox !== null && visibleInbox.length === 0 ? (
						<View className="items-center rounded-[24px] bg-card px-6 py-7">
							<Text className="text-center font-poppins font-semibold text-body-2 text-text">
								Noch keine Mitteilungen
							</Text>
							<Text className="mt-2 text-center font-poppins text-body-4 text-secondary-text">
								Hier erscheinen deine Erinnerungen.
							</Text>
						</View>
					) : null}

					{visibleInbox.map((notification) => (
						<NotificationCard
							key={notification.id}
							notification={notification}
							onDelete={() =>
								deleteNotification({
									id: notification.id,
									now: new Date().toISOString(),
								})
							}
						/>
					))}
				</View>
			</ScreenScroll>
			<NotificationDeliveryInfoSheet
				visible={showDeliveryInfo}
				pushStatus={pushDeliveryState.status}
				onClose={closeDeliveryInfo}
				pushAction={pushAction}
			/>
		</Screen>
	);
}
