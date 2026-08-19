import { useRouter } from "expo-router";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { ErrorMessage } from "~/components/ui/error-message";
import {
	ArrowRight,
	Bell,
	CalendarDays,
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
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAccountActions } from "~/context/AuthContext";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { logDiagnosticError } from "~/lib/diagnostics";
import { useDayovaTheme } from "~/lib/theme";
import { THEME_OPTIONS, type ThemePreference } from "~/lib/theme-preference";
import { cn } from "~/lib/utils";

const SETTINGS_CONTENT_MAX_WIDTH = 640;
const SETTINGS_EXPANDED_LAYOUT_MIN_WIDTH = 700;

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
	showDisclosure = true,
	expanded = false,
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
	showDisclosure?: boolean;
	expanded?: boolean;
}) {
	const Icon = icon;
	const { colors } = useDayovaTheme();

	return (
		<ListRow
			icon={
				<Icon size={expanded ? 26 : 22} color={colors.text} strokeWidth={2} />
			}
			iconContainerClassName={expanded ? "h-14 w-14 mr-4" : undefined}
			label={label}
			labelClassName={expanded ? "text-body-1" : undefined}
			onPress={onPress}
			disabled={disabled}
			accessibilityState={{
				busy,
				disabled,
			}}
			className={cn(
				"rounded-3xl bg-transparent px-3 shadow-none",
				expanded && "min-h-20 px-5 py-4",
			)}
			trailing={
				trailing ??
				(onPress && showDisclosure ? (
					<ArrowRight
						size={expanded ? 20 : 18}
						color={colors.secondaryText}
						strokeWidth={2}
					/>
				) : undefined)
			}
			variant="flat"
		/>
	);
}

function SettingsDivider() {
	return <View className="mx-4 h-px bg-border" />;
}

function SettingsSection({
	children,
	expanded = false,
	title,
}: {
	children: ReactNode;
	expanded?: boolean;
	title: string;
}) {
	return (
		<View className={expanded ? "gap-3" : "gap-2"}>
			<Text
				accessibilityRole="header"
				className={cn(
					"px-4 font-poppins font-semibold text-body-4 text-secondary-text",
					expanded && "px-5 text-body-3",
				)}
			>
				{title}
			</Text>
			<Surface className={cn("overflow-hidden p-2", expanded && "p-3")}>
				{children}
			</Surface>
		</View>
	);
}

function ThemePreferenceToggle({
	preference,
	setPreference,
	expanded = false,
}: {
	preference: ThemePreference;
	setPreference: (preference: ThemePreference) => Promise<void>;
	expanded?: boolean;
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
							"items-center justify-center rounded-full",
							expanded ? "h-12 w-12" : "h-11 w-11",
							isActive ? "bg-primary" : "bg-transparent",
						)}
						onPress={() => {
							void setPreference(option.value).catch((error: unknown) => {
								console.warn("Unable to save Dayova theme preference", error);
							});
						}}
					>
						<Icon
							size={expanded ? 22 : 20}
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
	const { width } = useWindowDimensions();
	const { logout } = useAccountActions();
	const { preference, setPreference } = useDayovaTheme();
	const [logoutError, setLogoutError] = useState<string | null>(null);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const expanded = width >= SETTINGS_EXPANDED_LAYOUT_MIN_WIDTH;
	const logoutGateRef = useRef(createAsyncActionGate());
	const handleLogout = () => {
		void logoutGateRef.current.run(async () => {
			setLogoutError(null);
			setIsLoggingOut(true);
			try {
				await logout();
			} catch (error) {
				logDiagnosticError("Failed to sign out.", error, {
					source: "settings.logout",
					level: "error",
				});
				setLogoutError(
					"Die Abmeldung ist fehlgeschlagen. Bitte versuche es erneut.",
				);
			} finally {
				setIsLoggingOut(false);
			}
		});
	};

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll
				contentMaxWidth={SETTINGS_CONTENT_MAX_WIDTH}
				testID="settings-scroll"
				topPadding={104}
				bottomPadding={120}
				horizontalPadding={24}
			>
				<View className={expanded ? "gap-9" : "gap-7"}>
					<SettingsSection expanded={expanded} title="Lernen">
						<SettingsRow
							expanded={expanded}
							icon={Timer}
							label="Lernzeiten"
							onPress={() => router.push("/learning-times")}
						/>
						<SettingsDivider />
						<SettingsRow
							expanded={expanded}
							icon={CalendarDays}
							label="Stundenplan"
							onPress={() => router.push("/timetable")}
						/>
					</SettingsSection>

					<SettingsSection expanded={expanded} title="App">
						<SettingsRow
							expanded={expanded}
							icon={Bell}
							label="Mitteilungen"
							onPress={() => router.push("/notification-settings")}
						/>
						<SettingsDivider />
						<SettingsRow
							expanded={expanded}
							icon={Palette}
							label="Design"
							trailing={
								<ThemePreferenceToggle
									expanded={expanded}
									preference={preference}
									setPreference={setPreference}
								/>
							}
						/>
					</SettingsSection>

					<View className="gap-3">
						<SettingsSection expanded={expanded} title="Konto">
							<SettingsRow
								expanded={expanded}
								icon={Settings}
								label="Profil"
								onPress={() => router.push("/profile")}
							/>
							<SettingsDivider />
							<SettingsRow
								expanded={expanded}
								icon={SquareLock}
								label="Passwort ändern"
								onPress={() => router.push("/change-password")}
							/>
							<SettingsDivider />
							<SettingsRow
								expanded={expanded}
								icon={Logout}
								label="Abmelden"
								onPress={handleLogout}
								disabled={isLoggingOut}
								busy={isLoggingOut}
								showDisclosure={false}
							/>
						</SettingsSection>
						{logoutError ? <ErrorMessage>{logoutError}</ErrorMessage> : null}
					</View>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
