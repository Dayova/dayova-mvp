import { Host, Switch } from "@expo/ui";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type * as ExpoNotifications from "expo-notifications";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	Platform,
	TouchableOpacity,
	View,
} from "react-native";
import { api } from "#convex/_generated/api";
import { ScreenHeader as Header } from "~/components/screen-header";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import { ChevronDown } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { DAYOVA_NOTIFICATION_CHANNEL_ID } from "~/lib/local-notification-scheduler";
import { goBackOrReplace } from "~/lib/navigation";
import type { NotificationPlanningPreferences } from "~/lib/notification-planner";

const OFFSET_OPTIONS = [5, 10, 15, 30, 60];

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

const timeToDate = (time: string) => {
	const match = /^(\d{1,2}):(\d{2})$/.exec(time);
	const date = new Date();
	date.setHours(Number(match?.[1] ?? 7), Number(match?.[2] ?? 30), 0, 0);
	return date;
};

const formatTime = (date: Date) =>
	`${date.getHours().toString().padStart(2, "0")}:${date
		.getMinutes()
		.toString()
		.padStart(2, "0")}`;

function SettingsCard({ children }: { children: React.ReactNode }) {
	return (
		<View
			className="rounded-[24px] bg-white px-5 py-4"
			style={{ boxShadow: "0 8px 18px rgba(20, 28, 48, 0.08)" }}
		>
			{children}
		</View>
	);
}

function SectionIntro({
	title,
	description,
}: {
	title: string;
	description?: string;
}) {
	return (
		<View style={{ gap: 6 }}>
			<Text
				className="font-bold font-poppins text-[#1A1A1A]"
				style={{ fontSize: 15, lineHeight: 20, includeFontPadding: false }}
			>
				{title}
			</Text>
			{description ? (
				<Text
					className="font-poppins text-[#8C8F98]"
					style={{ fontSize: 12, lineHeight: 17, includeFontPadding: false }}
				>
					{description}
				</Text>
			) : null}
		</View>
	);
}

function SwitchRow({
	label,
	value,
	disabled,
	onValueChange,
}: {
	label: string;
	value: boolean;
	disabled?: boolean;
	onValueChange: (value: boolean) => void;
}) {
	return (
		<SettingsCard>
			<View className="flex-row items-center justify-between" style={{ gap: 12 }}>
				<Text
					className="flex-1 font-poppins font-semibold text-[#1A1A1A]"
					style={{ fontSize: 14, lineHeight: 20, includeFontPadding: false }}
					numberOfLines={2}
				>
					{label}
				</Text>
				<Host matchContents>
					<Switch
						value={value}
						disabled={disabled}
						onValueChange={onValueChange}
					/>
				</Host>
			</View>
		</SettingsCard>
	);
}

export default function NotificationSettingsScreen() {
	const router = useRouter();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const updatePreferences = useMutation(api.notifications.updatePreferences);
	const preferences = useQuery(
		api.notifications.getPreferences,
		user && isConvexAuthenticated ? {} : "skip",
	) as NotificationPlanningPreferences | undefined;
	const [isUpdating, setIsUpdating] = useState(false);
	const [showBriefingTimePicker, setShowBriefingTimePicker] = useState(false);
	const briefingTimeDate = useMemo(
		() => timeToDate(preferences?.dailyBriefingTime ?? "07:30"),
		[preferences?.dailyBriefingTime],
	);

	const goBack = () => goBackOrReplace(router, "/settings");

	const update = async (patch: Partial<NotificationPlanningPreferences>) => {
		setIsUpdating(true);
		try {
			await updatePreferences(patch);
		} finally {
			setIsUpdating(false);
		}
	};

	const updateSystemNotifications = async (nextValue: boolean) => {
		if (!nextValue) {
			await update({ systemNotificationsEnabled: false });
			return;
		}

		const notifications = getNotificationsModule();
		if (!notifications) {
			Alert.alert(
				"Mitteilungen noch nicht bereit",
				"Bitte baue den iOS/Android Dev Client einmal neu, damit System-Mitteilungen verfügbar sind.",
			);
			await update({ systemNotificationsEnabled: false });
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

		const currentPermissions = await notifications.getPermissionsAsync();
		const permissions = hasNotificationPermission(
			notifications,
			currentPermissions,
		)
			? currentPermissions
			: await notifications.requestPermissionsAsync();

		if (!hasNotificationPermission(notifications, permissions)) {
			Alert.alert(
				"System-Mitteilungen sind deaktiviert",
				"Du bekommst Mitteilungen weiterhin im Dayova-Postfach. Aktiviere System-Mitteilungen in den Einstellungen, wenn Dayova dich außerhalb der App erinnern soll.",
				[
					{ text: "Abbrechen", style: "cancel" },
					{ text: "Einstellungen", onPress: () => Linking.openSettings() },
				],
			);
			await update({ systemNotificationsEnabled: false });
			return;
		}

		await update({ systemNotificationsEnabled: true });
	};

	return (
		<Screen>
			<StatusBar style="dark" />
			<ScreenScroll topPadding={72} bottomPadding={120} horizontalPadding={24}>
				<Header title="Mitteilungen" onBack={goBack} className="mb-7" />

				{preferences ? (
					<View style={{ gap: 22 }}>
						<SwitchRow
							label="System-Mitteilungen"
							value={preferences.systemNotificationsEnabled}
							disabled={isUpdating}
							onValueChange={(value) => void updateSystemNotifications(value)}
						/>

						<SectionIntro
							title="Tagesüberblick"
							description="Dein Tagesüberblick zeigt dir alle Lernzeiten, Prüfungen, Abgabetermine und Hausaufgaben-Bearbeitungszeiten, die für den Tag anstehen."
						/>
						<SwitchRow
							label="Tagesüberblick"
							value={preferences.dailyBriefingEnabled}
							disabled={isUpdating}
							onValueChange={(value) =>
								void update({ dailyBriefingEnabled: value })
							}
						/>
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel="Uhrzeit für Tagesüberblick ändern"
							activeOpacity={0.84}
							onPress={() => setShowBriefingTimePicker(true)}
						>
							<SettingsCard>
								<View className="flex-row items-center justify-between">
									<Text
										className="font-poppins font-semibold text-[#1A1A1A]"
										style={{
											fontSize: 14,
											lineHeight: 20,
											includeFontPadding: false,
										}}
									>
										Uhrzeit
									</Text>
									<View className="flex-row items-center" style={{ gap: 8 }}>
										<Text
											className="font-poppins text-[#8C8F98]"
											style={{
												fontSize: 12,
												lineHeight: 18,
												includeFontPadding: false,
											}}
										>
											{preferences.dailyBriefingTime}
										</Text>
										<ChevronDown size={16} color="#8C8F98" strokeWidth={2} />
									</View>
								</View>
							</SettingsCard>
						</TouchableOpacity>

						<SectionIntro
							title="Mitteilungen anpassen"
							description="Hier kannst du entscheiden, woran dich die App erinnern soll."
						/>
						<SwitchRow
							label="Vor Prüfung"
							value={preferences.beforeExamEnabled}
							disabled={isUpdating}
							onValueChange={(value) => void update({ beforeExamEnabled: value })}
						/>
						<SwitchRow
							label="Vor Lernzeit"
							value={preferences.beforeLearningTimeEnabled}
							disabled={isUpdating}
							onValueChange={(value) =>
								void update({ beforeLearningTimeEnabled: value })
							}
						/>
						<SwitchRow
							label="Vor Bearbeitung Hausaufgabe"
							value={preferences.beforeHomeworkWorkEnabled}
							disabled={isUpdating}
							onValueChange={(value) =>
								void update({ beforeHomeworkWorkEnabled: value })
							}
						/>
						<SwitchRow
							label="Vor Abgabe Hausaufgabe"
							value={preferences.beforeHomeworkDueEnabled}
							disabled={isUpdating}
							onValueChange={(value) =>
								void update({ beforeHomeworkDueEnabled: value })
							}
						/>

						<SectionIntro description="Hier kannst du einstellen, wie viele Minuten vorher dich die App an einzelne Ereignisse erinnern soll." title="Erinnerungszeit" />
						<View className="flex-row flex-wrap" style={{ gap: 8 }}>
							{OFFSET_OPTIONS.map((minutes) => {
								const selected = preferences.reminderOffsetMinutes === minutes;
								return (
									<TouchableOpacity
										key={minutes}
										accessibilityRole="button"
										accessibilityState={{ selected }}
										activeOpacity={0.84}
										onPress={() =>
											void update({ reminderOffsetMinutes: minutes })
										}
										className="rounded-full px-4 py-3"
										style={{
											backgroundColor: selected ? "#3A7BFF" : "#FFFFFF",
											boxShadow: selected
												? "0 8px 16px rgba(58, 123, 255, 0.18)"
												: "0 6px 14px rgba(20, 28, 48, 0.06)",
										}}
									>
										<Text
											className={`font-poppins font-semibold ${selected ? "text-white" : "text-[#1A1A1A]"}`}
											style={{
												fontSize: 13,
												lineHeight: 18,
												includeFontPadding: false,
											}}
										>
											{minutes} min
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>

						<SectionIntro
							title="Event vergessen"
							description="Falls du mal eine Aufgabe vergessen hast, erinnert Dayova dich nach dem Ende nochmal freundlich daran."
						/>
						<SwitchRow
							label="Event vergessen"
							value={preferences.forgottenEventEnabled}
							disabled={isUpdating}
							onValueChange={(value) =>
								void update({ forgottenEventEnabled: value })
							}
						/>
					</View>
				) : (
					<View className="items-center py-10">
						<ActivityIndicator color="#3A7BFF" />
					</View>
				)}
			</ScreenScroll>

			<DateTimePickerSheet
				visible={showBriefingTimePicker}
				value={briefingTimeDate}
				mode="time"
				display="spinner"
				onClose={() => setShowBriefingTimePicker(false)}
				onChange={(event, selectedDate) => {
					if (event.type === "dismissed") {
						setShowBriefingTimePicker(false);
						return;
					}
					if (!selectedDate) return;
					void update({ dailyBriefingTime: formatTime(selectedDate) });
				}}
			/>
		</Screen>
	);
}
