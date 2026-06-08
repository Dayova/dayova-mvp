import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type * as ExpoNotifications from "expo-notifications";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
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

function WarningBanner() {
	return (
		<View
			className="flex-row rounded-[24px] bg-[#FFF7E0] px-5 py-4"
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
	return (
		<View
			className="flex-row rounded-full bg-white p-1"
			style={{ boxShadow: "0 6px 16px rgba(20, 28, 48, 0.06)" }}
		>
			{CATEGORIES.map((category) => {
				const selected = value === category.key;
				return (
					<TouchableOpacity
						key={category.key}
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						activeOpacity={0.84}
						onPress={() => onChange(category.key)}
						className="h-10 flex-1 items-center justify-center rounded-full"
						style={{ backgroundColor: selected ? "#3A7BFF" : "transparent" }}
					>
						<Text
							className={`font-poppins font-semibold ${selected ? "text-white" : "text-[#1A1A1A]"}`}
							style={{ fontSize: 13, lineHeight: 18, includeFontPadding: false }}
						>
							{category.label}
						</Text>
					</TouchableOpacity>
				);
			})}
		</View>
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
			className="my-1 w-24 items-center justify-center rounded-r-[24px] bg-[#FF1E1E]"
		>
			<Trash2 size={28} color="#FFFFFF" strokeWidth={2.2} />
		</TouchableOpacity>
	);

	return (
		<Swipeable renderRightActions={renderRightActions} overshootRight={false}>
			<View
				className="my-1 flex-row rounded-[24px] bg-white px-5 py-4"
				style={{
					gap: 14,
					boxShadow: "0 8px 18px rgba(20, 28, 48, 0.08)",
				}}
			>
				<View className="h-10 w-10 items-center justify-center rounded-full bg-[#EFF5FF]">
					<NotificationIcon category={notification.category} />
				</View>
				<View className="flex-1" style={{ gap: 4 }}>
					<View className="flex-row items-start justify-between" style={{ gap: 8 }}>
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
						style={{ fontSize: 12, lineHeight: 18, includeFontPadding: false }}
					>
						{notification.body}
					</Text>
				</View>
			</View>
		</Swipeable>
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
			setHasSystemPermission(hasNotificationPermission(notifications, permissions));
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
	const goBack = () => goBackOrReplace(router, "/home");
	const visibleInbox = useMemo(() => inbox ?? [], [inbox]);

	return (
		<Screen>
			<StatusBar style="dark" />
			<ScreenScroll topPadding={72} bottomPadding={120} horizontalPadding={24}>
				<Header title="Mitteilungen" onBack={goBack} className="mb-7" />
				<View style={{ gap: 18 }}>
					{showWarning ? <WarningBanner /> : null}
					<CategoryTabs value={category} onChange={setCategory} />

					{inbox === null ? (
						<View className="items-center py-10">
							<ActivityIndicator color="#3A7BFF" />
						</View>
					) : null}

					{inbox !== null && visibleInbox.length === 0 ? (
						<View className="items-center rounded-[24px] bg-white px-6 py-8">
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
