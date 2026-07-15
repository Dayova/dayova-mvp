import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
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
import { NotificationDeliveryInfoSheet } from "~/components/notification-delivery-info-sheet";
import { ScreenHeader as Header } from "~/components/screen-header";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import {
	Bell,
	Check,
	ChevronDown,
	Info,
	Mail,
	Timer,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SelectSheet } from "~/components/ui/select-sheet";
import { Switch } from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { DAYOVA_NOTIFICATION_CHANNEL_ID } from "~/lib/local-notification-scheduler";
import { goBackOrReplace } from "~/lib/navigation";
import {
	getNotificationPermissionStatus,
	getNotificationsModule,
	hasNotificationPermission,
	useNotificationPermissionStatus,
} from "~/lib/notification-permissions";
import type { NotificationPlanningPreferences } from "~/lib/notification-planner";
import {
	applyNotificationPreferencePatch,
	clearConfirmedNotificationPreferencePatch,
	getNotificationPreferenceControlState,
	getNotificationPreferencePatchKeys,
	getPushNotificationDeliveryState,
	type NotificationPreferenceKey,
	removeNotificationPreferencePatchKeys,
} from "~/lib/notification-preferences";

const OFFSET_OPTIONS = [5, 10, 15, 30, 60];

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
		<View className="min-h-16 flex-row items-center justify-between gap-3 py-3">
			<Text
				className="flex-1 font-poppins font-semibold text-body-3 text-text"
				numberOfLines={2}
			>
				{label}
			</Text>
			<Switch value={value} disabled={disabled} onValueChange={onValueChange} />
		</View>
	);
});

function SettingsDivider() {
	return <View className="h-px bg-border" />;
}

function AlwaysOnBadge() {
	return (
		<View className="flex-row items-center gap-1 rounded-full bg-success-subtle px-3 py-1.5">
			<Check
				size={13}
				color={DAYOVA_DESIGN_SYSTEM.colors.success}
				strokeWidth={2.6}
			/>
			<Text className="font-poppins font-semibold text-body-5 text-success">
				Immer an
			</Text>
		</View>
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
	const [pendingPreferenceKeys, setPendingPreferenceKeys] = useState<
		NotificationPreferenceKey[]
	>([]);
	const [optimisticPreferencePatch, setOptimisticPreferencePatch] = useState<
		Partial<NotificationPlanningPreferences>
	>({});
	const { notificationPermissionStatus, setNotificationPermissionStatus } =
		useNotificationPermissionStatus();
	const [showDeliveryInfo, setShowDeliveryInfo] = useState(false);
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
					"Bitte baue den iOS/Android Dev Client einmal neu, damit Push-Mitteilungen verfügbar sind.",
				);
				setNotificationPermissionStatus("unavailable");
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
				setNotificationPermissionStatus("denied");
				Alert.alert(
					"Push-Mitteilungen sind deaktiviert",
					"Aktiviere Mitteilungen in den Systemeinstellungen, um sie auch außerhalb von Dayova zu erhalten.",
					[
						{ text: "Abbrechen", style: "cancel" },
						{ text: "Einstellungen", onPress: () => Linking.openSettings() },
					],
				);
				await update({ systemNotificationsEnabled: false });
				return;
			}

			setNotificationPermissionStatus(
				getNotificationPermissionStatus(notifications, permissions),
			);
			await update({ systemNotificationsEnabled: true });
		},
		[setNotificationPermissionStatus, update],
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

	const openDeliveryInfo = useCallback(() => {
		setShowDeliveryInfo(true);
	}, []);

	const closeDeliveryInfo = useCallback(() => {
		setShowDeliveryInfo(false);
	}, []);

	const enablePushFromInfo = useCallback(() => {
		closeDeliveryInfo();
		void updateSystemNotifications(true);
	}, [closeDeliveryInfo, updateSystemNotifications]);

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
	const controlState = getNotificationPreferenceControlState({
		preferences: preferencesForRender,
		pendingKeys: pendingPreferenceKeys,
	});
	const pushDeliveryState = getPushNotificationDeliveryState({
		preferenceEnabled:
			preferencesForRender?.systemNotificationsEnabled ?? false,
		permissionStatus: notificationPermissionStatus,
	});
	const pushSwitchValue =
		pushDeliveryState.status === "active" ||
		(pushDeliveryState.status === "checking" &&
			(preferencesForRender?.systemNotificationsEnabled ?? false));

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={72} bottomPadding={120} horizontalPadding={24}>
				<Header title="Mitteilungen" onBack={goBack} className="mb-7" />

				{preferencesForRender ? (
					<View className="gap-8">
						<View className="gap-3">
							<View className="flex-row items-center justify-between">
								<Text className="font-poppins font-semibold text-body-1 text-text">
									Zustellung
								</Text>
								<TouchableOpacity
									accessibilityLabel="Zustellung erklären"
									accessibilityRole="button"
									activeOpacity={0.72}
									className="h-10 w-10 items-center justify-center rounded-full bg-system-subtle"
									hitSlop={8}
									onPress={openDeliveryInfo}
								>
									<Info
										size={20}
										color={DAYOVA_DESIGN_SYSTEM.colors.primary}
										strokeWidth={2.2}
									/>
								</TouchableOpacity>
							</View>
							<SettingsCard>
								<View className="min-h-16 flex-row items-center gap-3 py-2">
									<View className="h-10 w-10 items-center justify-center rounded-full bg-system-subtle">
										<Mail
											size={20}
											color={DAYOVA_DESIGN_SYSTEM.colors.primary}
											strokeWidth={2.2}
										/>
									</View>
									<Text className="flex-1 font-poppins font-semibold text-body-3 text-text">
										Dayova-Postfach
									</Text>
									<AlwaysOnBadge />
								</View>
								<SettingsDivider />
								<View className="min-h-16 flex-row items-center gap-3 py-2">
									<View className="h-10 w-10 items-center justify-center rounded-full bg-system-subtle">
										<Bell
											size={20}
											color={DAYOVA_DESIGN_SYSTEM.colors.primary}
											strokeWidth={2.2}
										/>
									</View>
									<View className="flex-1">
										<Text className="font-poppins font-semibold text-body-3 text-text">
											Push-Mitteilungen
										</Text>
										<Text className="font-poppins text-body-5 text-secondary-text">
											Auch außerhalb der App
										</Text>
									</View>
									<Switch
										value={pushSwitchValue}
										disabled={controlState.systemNotificationsDisabled}
										onValueChange={updateSystemNotificationsFromSwitch}
									/>
								</View>
							</SettingsCard>
						</View>

						<View className="gap-4">
							<View className="flex-row items-center justify-between gap-3">
								<Text className="font-poppins font-semibold text-body-1 text-text">
									Mitteilungsarten
								</Text>
								<View className="rounded-full bg-system-subtle px-3 py-1.5">
									<Text className="font-poppins font-semibold text-body-5 text-primary">
										{pushDeliveryState.status === "active"
											? "Postfach + Push"
											: "Nur Postfach"}
									</Text>
								</View>
							</View>

							<SettingsCard>
								<SwitchRow
									label="Tagesüberblick"
									value={preferencesForRender.dailyBriefingEnabled}
									disabled={controlState.dailyBriefingDisabled}
									onValueChange={handleDailyBriefingEnabledChange}
								/>
								{preferencesForRender.dailyBriefingEnabled ? (
									<>
										<SettingsDivider />
										<TouchableOpacity
											accessibilityRole="button"
											accessibilityLabel="Uhrzeit für Tagesüberblick ändern"
											accessibilityState={{
												disabled: controlState.dailyBriefingTimeDisabled,
											}}
											activeOpacity={0.72}
											className="min-h-14 flex-row items-center gap-3 py-3"
											disabled={controlState.dailyBriefingTimeDisabled}
											onPress={openBriefingTimePicker}
										>
											<Timer
												size={18}
												color={DAYOVA_DESIGN_SYSTEM.colors.secondaryText}
												strokeWidth={2}
											/>
											<Text className="flex-1 font-poppins text-body-4 text-secondary-text">
												Täglich
											</Text>
											<Text className="font-poppins font-semibold text-body-4 text-text">
												{preferencesForRender.dailyBriefingTime}
											</Text>
											<ChevronDown
												size={16}
												color={DAYOVA_DESIGN_SYSTEM.colors.path3}
												strokeWidth={2}
											/>
										</TouchableOpacity>
									</>
								) : null}
							</SettingsCard>

							<SettingsCard>
								<SwitchRow
									label="Vor Prüfung"
									value={preferencesForRender.beforeExamEnabled}
									disabled={controlState.beforeExamDisabled}
									onValueChange={handleBeforeExamEnabledChange}
								/>
								<SettingsDivider />
								<SwitchRow
									label="Vor Lernzeit"
									value={preferencesForRender.beforeLearningTimeEnabled}
									disabled={controlState.beforeLearningTimeDisabled}
									onValueChange={handleBeforeLearningTimeEnabledChange}
								/>
								<SettingsDivider />
								<SwitchRow
									label="Vor Bearbeitung Hausaufgabe"
									value={preferencesForRender.beforeHomeworkWorkEnabled}
									disabled={controlState.beforeHomeworkWorkDisabled}
									onValueChange={handleBeforeHomeworkWorkEnabledChange}
								/>
								<SettingsDivider />
								<SwitchRow
									label="Vor Abgabe Hausaufgabe"
									value={preferencesForRender.beforeHomeworkDueEnabled}
									disabled={controlState.beforeHomeworkDueDisabled}
									onValueChange={handleBeforeHomeworkDueEnabledChange}
								/>
							</SettingsCard>

							<SettingsCard>
								<TouchableOpacity
									accessibilityRole="button"
									accessibilityLabel="Erinnerungszeit ändern"
									accessibilityState={{
										disabled: controlState.reminderOffsetDisabled,
									}}
									activeOpacity={0.72}
									className="min-h-16 flex-row items-center gap-3 py-3"
									disabled={controlState.reminderOffsetDisabled}
									onPress={openReminderOffsetSheet}
								>
									<Text className="flex-1 font-poppins font-semibold text-body-3 text-text">
										Vorher erinnern
									</Text>
									<Text className="font-poppins text-body-4 text-secondary-text">
										{preferencesForRender.reminderOffsetMinutes} min
									</Text>
									<ChevronDown
										size={16}
										color={DAYOVA_DESIGN_SYSTEM.colors.path3}
										strokeWidth={2}
									/>
								</TouchableOpacity>
								<SettingsDivider />
								<SwitchRow
									label="Nach verpasstem Ereignis"
									value={preferencesForRender.forgottenEventEnabled}
									disabled={controlState.forgottenEventDisabled}
									onValueChange={handleForgottenEventEnabledChange}
								/>
							</SettingsCard>
						</View>
					</View>
				) : (
					<View className="items-center py-10">
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
					</View>
				)}
			</ScreenScroll>

			<NotificationDeliveryInfoSheet
				visible={showDeliveryInfo}
				pushStatus={pushDeliveryState.status}
				onClose={closeDeliveryInfo}
				pushAction={{
					label: "Push-Mitteilungen aktivieren",
					onPress: enablePushFromInfo,
				}}
			/>
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
						color={
							isSelected
								? DAYOVA_DESIGN_SYSTEM.colors.primary
								: DAYOVA_DESIGN_SYSTEM.colors.secondaryText
						}
						strokeWidth={2}
					/>
				)}
			/>
		</Screen>
	);
}
