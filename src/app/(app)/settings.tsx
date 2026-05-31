import type * as ExpoNotifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
	Alert,
	Linking,
	Platform,
	Switch,
	View,
} from "react-native";
import { Bell, Logout, Settings } from "~/components/ui/icon";
import { ListRow } from "~/components/ui/list-row";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { useAuth } from "~/context/AuthContext";

const NOTIFICATION_SETTING_KEY = "dayova.notifications.enabled";

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

function SettingsRow({
	icon,
	label,
	trailing,
	onPress,
}: {
	icon: (props: {
		size?: number;
		color?: string;
		strokeWidth?: number;
	}) => React.JSX.Element;
	label: string;
	trailing?: React.JSX.Element;
	onPress?: () => void;
}) {
	const Icon = icon;

	return (
		<ListRow
			icon={<Icon size={22} color="#202127" strokeWidth={2} />}
			label={label}
			onPress={onPress}
			disabled={!onPress}
			trailing={trailing}
		/>
	);
}

export default function SettingsScreen() {
	const router = useRouter();
	const { logout } = useAuth();
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);

	useEffect(() => {
		let isMounted = true;

		const loadNotificationState = async () => {
			const notifications = getNotificationsModule();
			if (!notifications) {
				if (isMounted) setNotificationsEnabled(false);
				return;
			}

			const [savedPreference, permissions] = await Promise.all([
				SecureStore.getItemAsync(NOTIFICATION_SETTING_KEY),
				notifications.getPermissionsAsync(),
			]);

			if (!isMounted) return;
			setNotificationsEnabled(
				savedPreference === "true" &&
					hasNotificationPermission(notifications, permissions),
			);
		};

		void loadNotificationState();

		return () => {
			isMounted = false;
		};
	}, []);

	const enableNotifications = async () => {
		const notifications = getNotificationsModule();
		if (!notifications) {
			await SecureStore.setItemAsync(NOTIFICATION_SETTING_KEY, "false");
			setNotificationsEnabled(false);
			Alert.alert(
				"Mitteilungen noch nicht bereit",
				"Bitte baue den iOS/Android Dev Client einmal neu, damit expo-notifications als natives Modul verfügbar ist.",
			);
			return;
		}

		if (Platform.OS === "android") {
			await notifications.setNotificationChannelAsync("default", {
				name: "Dayova",
				importance: notifications.AndroidImportance.DEFAULT,
			});
		}

		const currentPermissions = await notifications.getPermissionsAsync();
		const permissions = hasNotificationPermission(
			notifications,
			currentPermissions,
		)
			? currentPermissions
			: await notifications.requestPermissionsAsync();

		if (!hasNotificationPermission(notifications, permissions)) {
			await SecureStore.setItemAsync(NOTIFICATION_SETTING_KEY, "false");
			setNotificationsEnabled(false);
			Alert.alert(
				"Mitteilungen deaktiviert",
				"Du kannst Push-Mitteilungen in den Systemeinstellungen aktivieren.",
				[
					{ text: "Abbrechen", style: "cancel" },
					{ text: "Einstellungen", onPress: () => Linking.openSettings() },
				],
			);
			return;
		}

		await SecureStore.setItemAsync(NOTIFICATION_SETTING_KEY, "true");
		setNotificationsEnabled(true);
	};

	const updateNotificationPreference = async (nextValue: boolean) => {
		setIsUpdatingNotifications(true);
		try {
			if (nextValue) {
				await enableNotifications();
				return;
			}

			await SecureStore.setItemAsync(NOTIFICATION_SETTING_KEY, "false");
			setNotificationsEnabled(false);
		} finally {
			setIsUpdatingNotifications(false);
		}
	};

	return (
		<Screen>
			<StatusBar style="dark" />
			<ScreenScroll topPadding={118} bottomPadding={150} horizontalPadding={24}>
				<View style={{ rowGap: 20 }}>
					<SettingsRow
						icon={Bell}
						label="Mitteilungen"
						trailing={
							<Switch
								value={notificationsEnabled}
								onValueChange={updateNotificationPreference}
								disabled={isUpdatingNotifications}
								trackColor={{ false: "#D3D6DC", true: "#CFE0FF" }}
								thumbColor="#FFFFFF"
								ios_backgroundColor="#D3D6DC"
							/>
						}
					/>
					<SettingsRow
						icon={Timer}
						label="Lernzeiten"
						onPress={() => router.push("/learning-times")}
					/>
				</View>

				<View style={{ height: 240 }} />

				<View style={{ rowGap: 20 }}>
					<SettingsRow
						icon={Settings}
						label="Profil"
						onPress={() => router.push("/profile")}
					/>
					<SettingsRow
						icon={Logout}
						label="Logout"
						onPress={async () => {
							await logout();
							router.replace("/");
						}}
					/>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
