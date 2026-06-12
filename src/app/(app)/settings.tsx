import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useWindowDimensions, View } from "react-native";
import { Bell, Logout, Settings, Timer } from "~/components/ui/icon";
import { ListRow } from "~/components/ui/list-row";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { useAuth } from "~/context/AuthContext";

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
	const { height } = useWindowDimensions();
	const sectionGap = Math.min(Math.max(height * 0.075, 44), 80);

	return (
		<Screen>
			<StatusBar style="dark" />
			<ScreenScroll topPadding={118} bottomPadding={150} horizontalPadding={24}>
				<View style={{ rowGap: 20 }}>
					<SettingsRow
						icon={Bell}
						label="Mitteilungen"
						onPress={() => router.push("/notification-settings")}
					/>
					<SettingsRow
						icon={Timer}
						label="Lernzeiten"
						onPress={() => router.push("/learning-times")}
					/>
				</View>

				<View style={{ height: sectionGap }} />

				<View style={{ rowGap: 20 }}>
					<SettingsRow
						icon={Settings}
						label="Profil"
						onPress={() => router.push("/profile")}
					/>
					<SettingsRow
						icon={Logout}
						label="Abmelden"
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
