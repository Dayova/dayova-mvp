import { useRouter } from "expo-router";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { ErrorMessage } from "~/components/ui/error-message";
import {
	ArrowRight,
	Bell,
	CalendarDays,
	Computer,
	CreditCard,
	Globe,
	Logout,
	Mail,
	Moon,
	Palette,
	Settings,
	Sparkles,
	SquareLock,
	Sun,
	Timer,
	Trash2,
} from "~/components/ui/icon";
import { ListRow } from "~/components/ui/list-row";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAccess } from "~/context/AccessContext";
import { useAiConsent } from "~/context/AiConsentContext";
import { useAccountActions } from "~/context/AuthContext";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { logDiagnosticError } from "~/lib/diagnostics";
import { openExternalUrl } from "~/lib/open-external-url";
import { env } from "~/lib/runtime-config";
import { getNativeSubscriptionManagementUrl } from "~/lib/store-subscription";
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
	showDisclosure = true,
	destructive = false,
	accessibilityLabel,
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
	destructive?: boolean;
	accessibilityLabel?: string;
}) {
	const Icon = icon;
	const { colors } = useDayovaTheme();

	return (
		<ListRow
			accessibilityLabel={accessibilityLabel}
			icon={
				<Icon
					size={22}
					color={destructive ? colors.destructive : colors.text}
					strokeWidth={2}
				/>
			}
			label={label}
			tone={destructive ? "destructive" : "default"}
			onPress={onPress}
			disabled={disabled}
			accessibilityState={{
				busy,
				disabled,
			}}
			className="rounded-3xl bg-transparent px-3 shadow-none"
			trailing={
				trailing ??
				(onPress && showDisclosure ? (
					<ArrowRight size={18} color={colors.secondaryText} strokeWidth={2} />
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
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	return (
		<View className="gap-2">
			<Text
				accessibilityRole="header"
				className="px-4 font-poppins font-semibold text-body-4 text-secondary-text"
			>
				{title}
			</Text>
			<Surface className="overflow-hidden p-2">{children}</Surface>
		</View>
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
	const { deleteAccount, logout } = useAccountActions();
	const { access } = useAccess();
	const { openAiConsentSettings, statusLabel: aiConsentStatusLabel } =
		useAiConsent();
	const { preference, setPreference } = useDayovaTheme();
	const [logoutError, setLogoutError] = useState<string | null>(null);
	const [linkError, setLinkError] = useState<string | null>(null);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const logoutGateRef = useRef(createAsyncActionGate());
	const deleteGateRef = useRef(createAsyncActionGate());
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
	const handleDeleteAccount = () => {
		void deleteGateRef.current.run(async () => {
			setDeleteError(null);
			setIsDeletingAccount(true);
			try {
				await deleteAccount();
				setShowDeleteConfirmation(false);
			} catch (error) {
				logDiagnosticError("Failed to delete account.", error, {
					source: "settings.accountDeletion",
					level: "error",
				});
				setDeleteError(
					"Das Konto konnte nicht vollständig gelöscht werden. Bitte versuche es erneut.",
				);
			} finally {
				setIsDeletingAccount(false);
			}
		});
	};
	const openLink = (url?: string) => {
		void openExternalUrl(url).then((opened) => {
			setLinkError(
				opened
					? null
					: "Der Link konnte nicht geöffnet werden. Bitte versuche es erneut.",
			);
		});
	};
	const nativeManagementUrl = getNativeSubscriptionManagementUrl({
		platform: process.env.EXPO_OS,
		store: access?.store,
	});
	const isStoreSubscriber =
		access?.state === "paid" || access?.state === "billingGrace";

	return (
		<>
			<Screen>
				<ThemedStatusBar />
				<ScreenScroll
					topPadding={104}
					bottomPadding={120}
					horizontalPadding={24}
				>
					<View className="gap-7">
						<SettingsSection title="Dayova Pro">
							{access?.state === "trial" ? (
								<SettingsRow
									icon={CreditCard}
									label="Dayova Pro abonnieren"
									onPress={() => router.push("/subscription")}
								/>
							) : (
								<SettingsRow
									icon={CreditCard}
									label={
										nativeManagementUrl
											? "Abo im Store verwalten"
											: "Hilfe zum Abo"
									}
									onPress={() =>
										openLink(nativeManagementUrl ?? env.EXPO_PUBLIC_SUPPORT_URL)
									}
									disabled={!isStoreSubscriber}
								/>
							)}
						</SettingsSection>

						<SettingsSection title="Lernen">
							<SettingsRow
								icon={Timer}
								label="Lernzeiten"
								onPress={() => router.push("/learning-times")}
							/>
							<SettingsDivider />
							<SettingsRow
								icon={CalendarDays}
								label="Stundenplan"
								onPress={() => router.push("/timetable")}
							/>
						</SettingsSection>

						<SettingsSection title="App">
							<SettingsRow
								icon={Bell}
								label="Mitteilungen"
								onPress={() => router.push("/notification-settings")}
							/>
							<SettingsDivider />
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
						</SettingsSection>

						<View className="gap-3">
							<SettingsSection title="Rechtliches & Hilfe">
								<SettingsRow
									icon={Sparkles}
									label="KI & Datenschutz"
									onPress={openAiConsentSettings}
									accessibilityLabel={`KI & Datenschutz, ${aiConsentStatusLabel}`}
									trailing={
										<View className="rounded-full bg-muted px-3 py-2">
											<Text className="font-poppins font-semibold text-body-5 text-secondary-text">
												{aiConsentStatusLabel}
											</Text>
										</View>
									}
								/>
								<SettingsDivider />
								<SettingsRow
									icon={Globe}
									label="Datenschutz"
									onPress={() => openLink(env.EXPO_PUBLIC_PRIVACY_URL)}
								/>
								<SettingsDivider />
								<SettingsRow
									icon={Globe}
									label="Nutzungsbedingungen"
									onPress={() => openLink(env.EXPO_PUBLIC_TERMS_URL)}
								/>
								<SettingsDivider />
								<SettingsRow
									icon={Mail}
									label="Support"
									onPress={() => openLink(env.EXPO_PUBLIC_SUPPORT_URL)}
								/>
							</SettingsSection>
							{linkError ? <ErrorMessage>{linkError}</ErrorMessage> : null}
						</View>

						<View className="gap-3">
							<SettingsSection title="Konto">
								<SettingsRow
									icon={Settings}
									label="Profil"
									onPress={() => router.push("/profile")}
								/>
								<SettingsDivider />
								<SettingsRow
									icon={SquareLock}
									label="Passwort ändern"
									onPress={() => router.push("/change-password")}
								/>
								<SettingsDivider />
								<SettingsRow
									icon={Logout}
									label="Abmelden"
									onPress={handleLogout}
									disabled={isLoggingOut}
									busy={isLoggingOut}
									showDisclosure={false}
								/>
								<SettingsDivider />
								<SettingsRow
									destructive
									icon={Trash2}
									label="Konto löschen"
									onPress={() => {
										setDeleteError(null);
										setShowDeleteConfirmation(true);
									}}
									disabled={isDeletingAccount}
									busy={isDeletingAccount}
									showDisclosure={false}
								/>
							</SettingsSection>
							{logoutError ? <ErrorMessage>{logoutError}</ErrorMessage> : null}
						</View>
					</View>
				</ScreenScroll>
			</Screen>
			<ConfirmationSheet
				visible={showDeleteConfirmation}
				title="Konto wirklich löschen?"
				description="Dein Dayova-Konto und deine gespeicherten Daten werden dauerhaft gelöscht. Ein aktives App-Store-Abo musst du zusätzlich im App Store kündigen."
				confirmLabel="Konto löschen"
				isBusy={isDeletingAccount}
				errorMessage={deleteError}
				onClose={() => setShowDeleteConfirmation(false)}
				onConfirm={handleDeleteAccount}
			/>
		</>
	);
}
