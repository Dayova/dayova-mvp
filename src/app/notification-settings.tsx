import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type * as ExpoNotifications from "expo-notifications";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { ChevronDown, Timer } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SelectSheet } from "~/components/ui/select-sheet";
import { Switch } from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { DAYOVA_NOTIFICATION_CHANNEL_ID } from "~/lib/local-notification-scheduler";
import { goBackOrReplace } from "~/lib/navigation";
import type { NotificationPlanningPreferences } from "~/lib/notification-planner";
import {
	applyNotificationPreferencePatch,
	clearConfirmedNotificationPreferencePatch,
	getNotificationPreferencePatchKeys,
	type NotificationPreferenceKey,
	removeNotificationPreferencePatchKeys,
} from "~/lib/notification-preferences";

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
			className="rounded-[24px] bg-card"
			// Platform-specific card density and native shadow values are not
			// expressible as a single static NativeWind class here.
			style={{
				paddingHorizontal: Platform.OS === "ios" ? 24 : 20,
				paddingVertical: Platform.OS === "ios" ? 20 : 16,
				boxShadow: "0 8px 18px rgba(20, 28, 48, 0.08)",
			}}
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
		<View className="gap-2">
			<Text className="font-poppins font-semibold text-body-3 text-foreground">
				{title}
			</Text>
			{description ? (
				<Text className="font-poppins text-body-4 text-muted-foreground">
					{description}
				</Text>
			) : null}
		</View>
	);
}

const addPendingPreferenceKeys = (
	currentKeys: NotificationPreferenceKey[],
	nextKeys: NotificationPreferenceKey[],
) => Array.from(new Set([...currentKeys, ...nextKeys]));

const removePendingPreferenceKeys = (
	currentKeys: NotificationPreferenceKey[],
	doneKeys: NotificationPreferenceKey[],
) => currentKeys.filter((key) => !doneKeys.includes(key));

const SwitchRow = memo(function SwitchRow({
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
			<View className="flex-row items-center justify-between gap-3">
				<Text
					className="flex-1 font-poppins font-semibold text-body-3 text-foreground"
					numberOfLines={2}
				>
					{label}
				</Text>
				<Switch
					value={value}
					disabled={disabled}
					onValueChange={onValueChange}
				/>
			</View>
		</SettingsCard>
	);
});

export default function NotificationSettingsScreen() {
	const router = useRouter();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const updatePreferences = useMutation(api.notifications.updatePreferences);
	const preferences = useQuery(
		api.notifications.getPreferences,
		user && isConvexAuthenticated ? {} : "skip",
	) as NotificationPlanningPreferences | undefined;
	const [pendingPreferenceKeys, setPendingPreferenceKeys] = useState<
		NotificationPreferenceKey[]
	>([]);
	const [optimisticPreferencePatch, setOptimisticPreferencePatch] = useState<
		Partial<NotificationPlanningPreferences>
	>({});
	const [showBriefingTimePicker, setShowBriefingTimePicker] = useState(false);
	const [showReminderOffsetSheet, setShowReminderOffsetSheet] = useState(false);
	const visiblePreferences = useMemo(
		() =>
			preferences
				? applyNotificationPreferencePatch(
						preferences,
						optimisticPreferencePatch,
					)
				: undefined,
		[optimisticPreferencePatch, preferences],
	);
	const briefingTimeDate = useMemo(
		() => timeToDate(visiblePreferences?.dailyBriefingTime ?? "07:30"),
		[visiblePreferences?.dailyBriefingTime],
	);

	useEffect(() => {
		if (!preferences) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- Reconcile optimistic UI state after the Convex subscription confirms it.
		setOptimisticPreferencePatch((currentPatch) =>
			clearConfirmedNotificationPreferencePatch(currentPatch, preferences),
		);
	}, [preferences]);

	const update = useCallback(
		async (patch: Partial<NotificationPlanningPreferences>) => {
			const patchKeys = getNotificationPreferencePatchKeys(patch);
			if (patchKeys.length === 0) return;

			setOptimisticPreferencePatch((currentPatch) => ({
				...currentPatch,
				...patch,
			}));
			setPendingPreferenceKeys((currentKeys) =>
				addPendingPreferenceKeys(currentKeys, patchKeys),
			);

			try {
				await updatePreferences(patch);
			} catch (error) {
				setOptimisticPreferencePatch((currentPatch) =>
					removeNotificationPreferencePatchKeys(currentPatch, patchKeys),
				);
				throw error;
			} finally {
				setPendingPreferenceKeys((currentKeys) =>
					removePendingPreferenceKeys(currentKeys, patchKeys),
				);
			}
		},
		[updatePreferences],
	);

	const updateSystemNotifications = useCallback(
		async (nextValue: boolean) => {
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
		},
		[update],
	);

	const handleDailyBriefingEnabledChange = useCallback(
		(value: boolean) => void update({ dailyBriefingEnabled: value }),
		[update],
	);
	const handleBeforeExamEnabledChange = useCallback(
		(value: boolean) => void update({ beforeExamEnabled: value }),
		[update],
	);
	const handleBeforeLearningTimeEnabledChange = useCallback(
		(value: boolean) => void update({ beforeLearningTimeEnabled: value }),
		[update],
	);
	const handleBeforeHomeworkWorkEnabledChange = useCallback(
		(value: boolean) => void update({ beforeHomeworkWorkEnabled: value }),
		[update],
	);
	const handleBeforeHomeworkDueEnabledChange = useCallback(
		(value: boolean) => void update({ beforeHomeworkDueEnabled: value }),
		[update],
	);
	const handleForgottenEventEnabledChange = useCallback(
		(value: boolean) => void update({ forgottenEventEnabled: value }),
		[update],
	);

	const updateSystemNotificationsFromSwitch = useCallback(
		(value: boolean) => void updateSystemNotifications(value),
		[updateSystemNotifications],
	);

	const isPreferencePending = useCallback(
		(key: NotificationPreferenceKey) => pendingPreferenceKeys.includes(key),
		[pendingPreferenceKeys],
	);

	const updateBriefingTime = useCallback(
		(selectedDate: Date) => {
			void update({ dailyBriefingTime: formatTime(selectedDate) });
		},
		[update],
	);

	const updateReminderOffset = useCallback(
		(minutes: number) => {
			void update({ reminderOffsetMinutes: minutes });
		},
		[update],
	);

	const openBriefingTimePicker = useCallback(() => {
		setShowBriefingTimePicker(true);
	}, []);

	const closeBriefingTimePicker = useCallback(() => {
		setShowBriefingTimePicker(false);
	}, []);

	const openReminderOffsetSheet = useCallback(() => {
		setShowReminderOffsetSheet(true);
	}, []);

	const closeReminderOffsetSheet = useCallback(() => {
		setShowReminderOffsetSheet(false);
	}, []);

	const handleBriefingTimeChange = useCallback(
		(event: { type: "set" | "dismissed" }, selectedDate?: Date) => {
			if (Platform.OS === "android" || event.type === "dismissed") {
				closeBriefingTimePicker();
			}
			if (event.type === "dismissed") return;
			if (!selectedDate) return;
			updateBriefingTime(selectedDate);
		},
		[closeBriefingTimePicker, updateBriefingTime],
	);

	const goBack = useCallback(
		() => goBackOrReplace(router, "/settings"),
		[router],
	);

	const preferencesForRender = visiblePreferences;

	const areNotificationDetailsDisabled =
		preferencesForRender?.systemNotificationsEnabled === false;
	const isReminderOffsetPending = isPreferencePending("reminderOffsetMinutes");
	const areReminderOffsetsDisabled =
		areNotificationDetailsDisabled || isReminderOffsetPending;

	return (
		<Screen>
			<StatusBar style="dark" />
			<ScreenScroll topPadding={72} bottomPadding={120} horizontalPadding={24}>
				<Header title="Mitteilungen" onBack={goBack} className="mb-7" />

				{preferencesForRender ? (
					<View className="gap-6">
						<SwitchRow
							label="System-Mitteilungen"
							value={preferencesForRender.systemNotificationsEnabled}
							disabled={isPreferencePending("systemNotificationsEnabled")}
							onValueChange={updateSystemNotificationsFromSwitch}
						/>

						<View
							style={{
								gap: 24,
								opacity: areNotificationDetailsDisabled ? 0.46 : 1,
							}}
						>
							<SectionIntro
								title="Tagesüberblick"
								description="Dein Tagesüberblick zeigt dir alle Lernzeiten, Prüfungen, Abgabetermine und Hausaufgaben-Bearbeitungszeiten, die für den Tag anstehen."
							/>
							<SwitchRow
								label="Tagesüberblick"
								value={preferencesForRender.dailyBriefingEnabled}
								disabled={
									areNotificationDetailsDisabled ||
									isPreferencePending("dailyBriefingEnabled")
								}
								onValueChange={handleDailyBriefingEnabledChange}
							/>
							<View className="gap-4">
								<Text className="font-poppins text-body-4 text-muted-foreground">
									Wähle aus, wann du deinen Tagesüberblick erhalten möchtest.
								</Text>
								<TouchableOpacity
									accessibilityRole="button"
									accessibilityLabel="Uhrzeit für Tagesüberblick ändern"
									accessibilityState={{
										disabled: areNotificationDetailsDisabled,
									}}
									activeOpacity={0.84}
									className="flex-row items-center justify-between rounded-[24px] bg-card"
									disabled={areNotificationDetailsDisabled}
									onPress={openBriefingTimePicker}
									// Platform-specific row density and native shadow values are
									// runtime/platform decisions, not static design tokens.
									style={{
										minHeight: Platform.OS === "ios" ? 64 : 56,
										paddingHorizontal: Platform.OS === "ios" ? 24 : 20,
										...(Platform.OS === "ios" ? { paddingVertical: 16 } : {}),
										boxShadow: "0 8px 18px rgba(20, 28, 48, 0.08)",
									}}
								>
									<Text
										className="flex-1 font-poppins font-semibold text-body-3 text-foreground"
										numberOfLines={1}
									>
										Uhrzeit
									</Text>
									<View className="flex-row items-center gap-2">
										<Text className="font-poppins text-body-4 text-muted-foreground">
											{preferencesForRender.dailyBriefingTime}
										</Text>
										<ChevronDown size={16} color="#8C8F98" strokeWidth={2} />
									</View>
								</TouchableOpacity>
							</View>

							<SectionIntro
								title="Mitteilungen anpassen"
								description="Hier kannst du entscheiden, woran dich die App erinnern soll."
							/>
							<SwitchRow
								label="Vor Prüfung"
								value={preferencesForRender.beforeExamEnabled}
								disabled={
									areNotificationDetailsDisabled ||
									isPreferencePending("beforeExamEnabled")
								}
								onValueChange={handleBeforeExamEnabledChange}
							/>
							<SwitchRow
								label="Vor Lernzeit"
								value={preferencesForRender.beforeLearningTimeEnabled}
								disabled={
									areNotificationDetailsDisabled ||
									isPreferencePending("beforeLearningTimeEnabled")
								}
								onValueChange={handleBeforeLearningTimeEnabledChange}
							/>
							<SwitchRow
								label="Vor Bearbeitung Hausaufgabe"
								value={preferencesForRender.beforeHomeworkWorkEnabled}
								disabled={
									areNotificationDetailsDisabled ||
									isPreferencePending("beforeHomeworkWorkEnabled")
								}
								onValueChange={handleBeforeHomeworkWorkEnabledChange}
							/>
							<SwitchRow
								label="Vor Abgabe Hausaufgabe"
								value={preferencesForRender.beforeHomeworkDueEnabled}
								disabled={
									areNotificationDetailsDisabled ||
									isPreferencePending("beforeHomeworkDueEnabled")
								}
								onValueChange={handleBeforeHomeworkDueEnabledChange}
							/>

							<SectionIntro
								description="Hier kannst du einstellen, wie viele Minuten vorher dich die App an einzelne Ereignisse erinnern soll."
								title="Erinnerungszeit"
							/>
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel="Erinnerungszeit ändern"
								accessibilityState={{ disabled: areReminderOffsetsDisabled }}
								activeOpacity={0.84}
								className="flex-row items-center justify-between rounded-[24px] bg-card"
								disabled={areReminderOffsetsDisabled}
								onPress={openReminderOffsetSheet}
								// Platform-specific row density and native shadow values are
								// runtime/platform decisions, not static design tokens.
								style={{
									minHeight: Platform.OS === "ios" ? 64 : 56,
									paddingHorizontal: Platform.OS === "ios" ? 24 : 20,
									...(Platform.OS === "ios" ? { paddingVertical: 16 } : {}),
									boxShadow: "0 8px 18px rgba(20, 28, 48, 0.08)",
								}}
							>
								<Text
									className="flex-1 font-poppins font-semibold text-body-3 text-foreground"
									numberOfLines={1}
								>
									Vorher erinnern
								</Text>
								<View className="flex-row items-center gap-2">
									<Text className="font-poppins text-body-4 text-muted-foreground">
										{preferencesForRender.reminderOffsetMinutes} min
									</Text>
									<ChevronDown size={16} color="#8C8F98" strokeWidth={2} />
								</View>
							</TouchableOpacity>

							<SectionIntro
								title="Event vergessen"
								description="Falls du mal eine Aufgabe vergessen hast, erinnert Dayova dich nach dem Ende nochmal freundlich daran."
							/>
							<SwitchRow
								label="Event vergessen"
								value={preferencesForRender.forgottenEventEnabled}
								disabled={
									areNotificationDetailsDisabled ||
									isPreferencePending("forgottenEventEnabled")
								}
								onValueChange={handleForgottenEventEnabledChange}
							/>
						</View>
					</View>
				) : (
					<View className="items-center py-10">
						<ActivityIndicator color="#00BAFF" />
					</View>
				)}
			</ScreenScroll>

			<DateTimePickerSheet
				visible={showBriefingTimePicker}
				value={briefingTimeDate}
				mode="time"
				display="spinner"
				onClose={closeBriefingTimePicker}
				onChange={handleBriefingTimeChange}
			/>
			<SelectSheet
				visible={showReminderOffsetSheet}
				title="Erinnerungszeit auswählen"
				options={OFFSET_OPTIONS}
				selectedValue={preferencesForRender?.reminderOffsetMinutes ?? ""}
				onClose={closeReminderOffsetSheet}
				onSelect={updateReminderOffset}
				formatOptionLabel={(minutes) => `${minutes} min`}
				renderOptionIcon={(_, isSelected) => (
					<Timer
						size={19}
						color={isSelected ? "#00BAFF" : "#697586"}
						strokeWidth={2}
					/>
				)}
			/>
		</Screen>
	);
}
