import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import type * as ExpoNotifications from "expo-notifications";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	TouchableOpacity,
	View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
	Easing,
	interpolateColor,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import {
	BookOpen,
	CircleAlert,
	ClipboardList,
	Mail,
	Trash2,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { goBackOrReplace } from "~/lib/navigation";
import type { NotificationPlanningPreferences } from "~/lib/notification-planner";

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
		return <BookOpen size={22} color="#3A7BFF" strokeWidth={2} />;
	}
	if (category === "task") {
		return <ClipboardList size={22} color="#3A7BFF" strokeWidth={2} />;
	}
	return <Mail size={22} color="#3A7BFF" strokeWidth={2} />;
}

function WarningBanner({
	ctaLabel,
	onPressCta,
}: {
	ctaLabel: string;
	onPressCta: () => void;
}) {
	return (
		<View
			className="flex-row rounded-[24px] bg-[#FFF7E0] px-5 py-5"
			style={{ gap: 12 }}
		>
			<CircleAlert size={22} color="#F59E0B" strokeWidth={2.2} />
			<View className="flex-1" style={{ gap: 4 }}>
				<Text
					className="font-bold font-poppins text-[#7A5A12]"
					style={{ fontSize: 14, lineHeight: 20, includeFontPadding: false }}
				>
					System-Mitteilungen sind aus
				</Text>
				<Text
					className="font-poppins text-[#7A5A12]"
					style={{ fontSize: 12, lineHeight: 18, includeFontPadding: false }}
				>
					Du bekommst Mitteilungen weiterhin hier im Postfach. Aktiviere
					System-Mitteilungen, wenn Dayova dich außerhalb der App erinnern soll.
				</Text>
				<TouchableOpacity
					accessibilityRole="button"
					accessibilityLabel={ctaLabel}
					activeOpacity={0.82}
					onPress={onPressCta}
					className="mt-2 self-start rounded-full bg-white"
					style={{
						minHeight: 38,
						paddingHorizontal: 20,
						paddingVertical: 10,
					}}
				>
					<Text
						className="font-poppins font-semibold text-[#7A5A12]"
						style={{ fontSize: 12, lineHeight: 16, includeFontPadding: false }}
					>
						{ctaLabel}
					</Text>
				</TouchableOpacity>
			</View>
		</View>
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
		width: indicatorWidth.value,
		transform: [{ translateX: selectionPosition.value * indicatorWidth.value }],
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
			className="flex-row rounded-full bg-white"
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
			Math.min(Math.abs(selectionPosition.value - index), 1),
			[0, 1],
			["#FFFFFF", "#1A1A1A"],
		),
	}));

	return (
		<Animated.Text
			className="font-poppins font-semibold"
			style={[
				{ fontSize: 13, lineHeight: 18, includeFontPadding: false },
				animatedStyle,
			]}
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
	onDelete: () => void;
}) {
	const renderRightActions = () => (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel="Mitteilung löschen"
			activeOpacity={0.9}
			onPress={onDelete}
			className="w-24 items-center justify-center rounded-r-[24px] bg-[#FF1E1E]"
		>
			<Trash2 size={28} color="#FFFFFF" strokeWidth={2.2} />
		</TouchableOpacity>
	);

	return (
		<View
			className="my-1 rounded-[24px]"
			style={{ boxShadow: "0 8px 18px rgba(20, 28, 48, 0.08)" }}
		>
			<Swipeable
				renderRightActions={renderRightActions}
				overshootRight={false}
				containerStyle={{ borderRadius: 24 }}
			>
				<View
					className="flex-row rounded-[24px] bg-white px-5 py-12"
					style={{ gap: 14 }}
				>
					<View className="h-10 w-10 items-center justify-center rounded-full bg-[#EFF5FF]">
						<NotificationIcon category={notification.category} />
					</View>
					<View className="flex-1" style={{ gap: 4 }}>
						<View
							className="flex-row items-start justify-between"
							style={{ gap: 8 }}
						>
							<Text
								className="flex-1 font-bold font-poppins text-[#1A1A1A]"
								style={{
									fontSize: 15,
									lineHeight: 20,
									includeFontPadding: false,
								}}
								numberOfLines={1}
							>
								{notification.title}
							</Text>
							<View className="rounded-full bg-[#F4F4F5] px-3 py-1">
								<Text
									className="font-poppins text-[#70727A]"
									style={{
										fontSize: 11,
										lineHeight: 15,
										includeFontPadding: false,
									}}
								>
									{formatRelativeTime(notification.triggeredAt)}
								</Text>
							</View>
						</View>
						<Text
							className="font-poppins text-[#7A7D86]"
							style={{
								fontSize: 12,
								lineHeight: 18,
								includeFontPadding: false,
							}}
						>
							{notification.body}
						</Text>
					</View>
				</View>
			</Swipeable>
		</View>
	);
}

export default function NotificationsScreen() {
	const router = useRouter();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const [category, setCategory] = useState<InboxCategory>("all");
	const [hasSystemPermission, setHasSystemPermission] = useState(false);
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
		const notifications = getNotificationsModule();
		if (!notifications) return;

		let isMounted = true;
		void notifications.getPermissionsAsync().then((permissions) => {
			if (!isMounted) return;
			setHasSystemPermission(
				hasNotificationPermission(notifications, permissions),
			);
		});

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (!user || !isConvexAuthenticated) return;
		void markAllRead({ now: new Date().toISOString() });
	}, [isConvexAuthenticated, markAllRead, user]);

	const showWarning =
		preferences !== undefined &&
		(!preferences.systemNotificationsEnabled || !hasSystemPermission);
	const warningCtaLabel = preferences?.systemNotificationsEnabled
		? "System-Einstellungen öffnen"
		: "In Dayova aktivieren";
	const openNotificationFix = () => {
		if (!preferences?.systemNotificationsEnabled) {
			router.push("/notification-settings");
			return;
		}
		void Linking.openSettings();
	};
	const goBack = () => goBackOrReplace(router, "/home");
	const visibleInbox = useMemo(() => inbox ?? [], [inbox]);

	return (
		<Screen>
			<StatusBar style="dark" />
			<ScreenScroll topPadding={72} bottomPadding={120} horizontalPadding={24}>
				<Header title="Mitteilungen" onBack={goBack} className="mb-7" />
				<View style={{ gap: 18 }}>
					<CategoryTabs value={category} onChange={setCategory} />
					{showWarning ? (
						<WarningBanner
							ctaLabel={warningCtaLabel}
							onPressCta={openNotificationFix}
						/>
					) : null}

					{inbox === null ? (
						<View className="items-center py-10">
							<ActivityIndicator color="#3A7BFF" />
						</View>
					) : null}

					{inbox !== null && visibleInbox.length === 0 ? (
						<View className="items-center rounded-[24px] bg-white px-6 py-11">
							<Text
								className="text-center font-bold font-poppins text-[#1A1A1A]"
								style={{
									fontSize: 16,
									lineHeight: 22,
									includeFontPadding: false,
								}}
							>
								Keine Mitteilungen
							</Text>
							<Text
								className="mt-2 text-center font-poppins text-[#8C8F98]"
								style={{
									fontSize: 13,
									lineHeight: 19,
									includeFontPadding: false,
								}}
							>
								Neue Erinnerungen erscheinen hier automatisch.
							</Text>
						</View>
					) : null}

					{visibleInbox.map((notification) => (
						<NotificationCard
							key={notification.id}
							notification={notification}
							onDelete={() =>
								void deleteNotification({
									id: notification.id,
									now: new Date().toISOString(),
								})
							}
						/>
					))}
				</View>
			</ScreenScroll>
		</Screen>
	);
}
