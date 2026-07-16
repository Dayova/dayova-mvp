import { useRouter } from "expo-router";
import { Pressable, useWindowDimensions, View } from "react-native";
import {
	Bell,
	Computer,
	Logout,
	Moon,
	Palette,
	Settings,
	SquareLock,
	Sun,
	Timer,
} from "~/components/ui/icon";
import { ListRow } from "~/components/ui/list-row";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { useDayovaTheme } from "~/lib/theme";
import { THEME_OPTIONS, type ThemePreference } from "~/lib/theme-preference";
import { cn } from "~/lib/utils";

const themeIconByPreference = {
	light: Sun,
	system: Computer,
	dark: Moon,
} satisfies Record<
	ThemePreference,
	(props: {
		size?: number;
		color?: string;
		strokeWidth?: number;
	}) => React.JSX.Element
>;

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
	const { colors } = useDayovaTheme();

	return (
		<ListRow
			icon={<Icon size={22} color={colors.text} strokeWidth={2} />}
			label={label}
			onPress={onPress}
			disabled={!onPress}
			trailing={trailing}
		/>
	);
}

function ThemePreferenceToggle({
	preference,
	setPreference,
}: {
	preference: ThemePreference;
	setPreference: (preference: ThemePreference) => Promise<void>;
}) {
	const { colors } = useDayovaTheme();

	return (
		<View className="flex-row rounded-full border border-border/70 bg-muted p-1">
			{THEME_OPTIONS.map((option) => {
				const Icon = themeIconByPreference[option.value];
				const isActive = preference === option.value;

				return (
					<Pressable
						key={option.value}
						accessibilityLabel={option.accessibilityLabel}
						accessibilityRole="radio"
						accessibilityState={{ checked: isActive }}
						className={cn(
							"h-11 w-11 items-center justify-center rounded-full",
							isActive ? "bg-primary" : "bg-transparent",
						)}
						onPress={() => {
							void setPreference(option.value).catch((error: unknown) => {
								console.warn("Unable to save Dayova theme preference", error);
							});
						}}
					>
						<Icon
							size={20}
							color={isActive ? "#FFFFFF" : colors.secondaryText}
							strokeWidth={2}
						/>
					</Pressable>
				);
			})}
		</View>
	);
}

export default function SettingsScreen() {
	const router = useRouter();
	const { logout } = useAuth();
	const { preference, setPreference } = useDayovaTheme();
	const { height } = useWindowDimensions();
	const contentMinHeight = Math.max(height - 268, 360);

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={118} bottomPadding={150} horizontalPadding={24}>
				<View
					style={{
						minHeight: contentMinHeight,
						justifyContent: "space-between",
					}}
				>
					<View className="gap-5">
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
						<SettingsRow
							icon={Palette}
							label="Design"
							trailing={
								<ThemePreferenceToggle
									preference={preference}
									setPreference={setPreference}
								/>
							}
						/>
					</View>

					<View className="gap-5">
						<SettingsRow
							icon={Settings}
							label="Profil"
							onPress={() => router.push("/profile")}
						/>
						<SettingsRow
							icon={SquareLock}
							label="Passwort ändern"
							onPress={() => router.push("/change-password")}
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
				</View>
			</ScreenScroll>
		</Screen>
	);
}
