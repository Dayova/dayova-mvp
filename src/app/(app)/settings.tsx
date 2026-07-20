import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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
import { ErrorMessage } from "~/components/ui/error-message";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAccountActions } from "~/context/AuthContext";
import { createAsyncActionGate } from "~/lib/async-action-gate";
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
	disabled = false,
	busy = false,
}: {
	icon: (props: {
		size?: number;
		color?: string;
		strokeWidth?: number;
	}) => React.JSX.Element;
	label: string;
	trailing?: React.JSX.Element;
	onPress?: () => void;
	disabled?: boolean;
	busy?: boolean;
}) {
	const Icon = icon;
	const { colors } = useDayovaTheme();

	return (
		<ListRow
			icon={<Icon size={22} color={colors.text} strokeWidth={2} />}
			label={label}
			onPress={onPress}
			disabled={disabled || !onPress}
			accessibilityState={{
				busy,
				disabled: disabled || !onPress,
			}}
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
	const { logout } = useAccountActions();
	const { preference, setPreference } = useDayovaTheme();
	const { height } = useWindowDimensions();
	const [logoutError, setLogoutError] = useState<string | null>(null);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const logoutGateRef = useRef(createAsyncActionGate());
	const contentMinHeight = Math.max(height - 268, 360);
	const handleLogout = () => {
		void logoutGateRef.current.run(async () => {
			setLogoutError(null);
			setIsLoggingOut(true);
			try {
				await logout();
			} catch (error) {
				setLogoutError(
					error instanceof Error
						? error.message
						: "Die Abmeldung ist fehlgeschlagen. Bitte versuche es erneut.",
				);
			} finally {
				setIsLoggingOut(false);
			}
		});
	};

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
							onPress={handleLogout}
							disabled={isLoggingOut}
							busy={isLoggingOut}
						/>
						{logoutError ? <ErrorMessage>{logoutError}</ErrorMessage> : null}
					</View>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
