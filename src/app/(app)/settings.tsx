import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, Switch, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, CalendarAdd, Logout, Settings } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
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
		<TouchableOpacity
			accessibilityLabel={label}
			accessibilityRole={onPress ? "button" : "text"}
			accessibilityState={{ disabled: !onPress }}
			activeOpacity={0.85}
			onPress={onPress}
			disabled={!onPress}
			className="min-h-[76px] flex-row items-center rounded-full bg-white pr-5 pl-7"
			style={{
				borderWidth: 1,
				borderColor: "rgba(17,24,39,0.04)",
				boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
			}}
		>
			<View
				className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white"
				style={{
					borderWidth: 1,
					borderColor: "rgba(17,24,39,0.05)",
					boxShadow: "0 8px 18px rgba(22, 29, 48, 0.08)",
				}}
			>
				<Icon size={23} color="#202127" strokeWidth={2} />
			</View>
			<Text
				className="ml-3 flex-1 font-poppins font-semibold text-[#17171C]"
				style={{ fontSize: 18, lineHeight: 22, includeFontPadding: false }}
			>
				{label}
			</Text>
			<View className="self-center" style={{ marginTop: 2 }}>
				{trailing}
			</View>
		</TouchableOpacity>
	);
}

export default function SettingsScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { logout } = useAuth();
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);

	return (
		<View className="flex-1 bg-[#F6F4F7]">
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingTop: Math.max(insets.top + 56, 118),
					paddingHorizontal: 24,
					paddingBottom: 150,
				}}
			>
				<View style={{ rowGap: 20 }}>
					<SettingsRow icon={CalendarAdd} label="Lernzeiten" />
					<SettingsRow
						icon={Bell}
						label="Mitteilungen"
						trailing={
							<Switch
								value={notificationsEnabled}
								onValueChange={setNotificationsEnabled}
								trackColor={{ false: "#D3D6DC", true: "#CFE0FF" }}
								thumbColor="#FFFFFF"
								ios_backgroundColor="#D3D6DC"
							/>
						}
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
							router.replace("/login");
						}}
					/>
				</View>
			</ScrollView>
		</View>
	);
}
