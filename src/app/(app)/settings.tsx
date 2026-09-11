import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ErrorMessage } from "~/components/ui/error-message";
import {
	Bell,
	CalendarDays,
	Computer,
	CreditCard,
	Globe,
	Mail,
	Moon,
	Palette,
	Sparkles,
	Sun,
	Timer,
	UserRound,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAccess } from "~/context/AccessContext";
import { useAiConsent } from "~/context/AiConsentContext";
import { useAuthSession } from "~/context/AuthContext";
import {
	SettingsCard,
	SettingsDivider,
	SettingsRow,
	SettingsSection,
} from "~/features/settings/settings-list";
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
	const { user } = useAuthSession();
	const profileName = user?.name?.trim();
	const { access } = useAccess();
	const { openAiConsentSettings, statusLabel: aiConsentStatusLabel } =
		useAiConsent();
	const { preference, setPreference } = useDayovaTheme();
	const [linkErrors, setLinkErrors] = useState<
		Partial<Record<"support" | "subscription" | "legal", string>>
	>({});
	const openLink = (
		section: "support" | "subscription" | "legal",
		url?: string,
	) => {
		void openExternalUrl(url).then((opened) => {
			setLinkErrors((current) => ({
				...current,
				[section]: opened
					? undefined
					: "Der Link konnte nicht geöffnet werden. Bitte versuche es erneut.",
			}));
		});
	};
	const nativeManagementUrl = getNativeSubscriptionManagementUrl({
		platform: process.env.EXPO_OS,
		store: access?.store,
	});
	const isStoreSubscriber =
		access?.state === "paid" || access?.state === "billingGrace";

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={104} bottomPadding={120} horizontalPadding={24}>
				<View className="gap-7">
					<SettingsCard>
						<SettingsRow
							icon={UserRound}
							label={profileName || "Profil & Konto"}
							description={profileName ? "Profil & Konto" : undefined}
							accessibilityLabel={
								profileName
									? `${profileName}, Profil & Konto`
									: "Profil & Konto"
							}
							onPress={() => router.push("/profile")}
						/>
					</SettingsCard>

					<View className="gap-3" testID="settings-support">
						<SettingsCard>
							<SettingsRow
								icon={Mail}
								label="Support kontaktieren"
								onPress={() => openLink("support", env.EXPO_PUBLIC_SUPPORT_URL)}
							/>
						</SettingsCard>
						{linkErrors.support ? (
							<ErrorMessage>{linkErrors.support}</ErrorMessage>
						) : null}
					</View>

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

					<View className="gap-3" testID="settings-subscription">
						<SettingsCard>
							{access?.state === "trial" ? (
								<SettingsRow
									icon={CreditCard}
									label="Dayova abonnieren"
									onPress={() => router.push("/subscription")}
								/>
							) : (
								<SettingsRow
									icon={CreditCard}
									label="Dayova"
									accessibilityLabel={`Dayova, ${nativeManagementUrl ? "Abo im Store verwalten" : "Hilfe zum Abo"}`}
									description={
										nativeManagementUrl
											? "Abo im Store verwalten"
											: "Hilfe zum Abo"
									}
									onPress={() =>
										openLink(
											"subscription",
											nativeManagementUrl ?? env.EXPO_PUBLIC_SUPPORT_URL,
										)
									}
									disabled={!isStoreSubscriber}
								/>
							)}
						</SettingsCard>
						{linkErrors.subscription ? (
							<ErrorMessage>{linkErrors.subscription}</ErrorMessage>
						) : null}
					</View>

					<View className="gap-3" testID="settings-legal">
						<SettingsSection title="Datenschutz & Rechtliches">
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
								onPress={() => openLink("legal", env.EXPO_PUBLIC_PRIVACY_URL)}
							/>
							<SettingsDivider />
							<SettingsRow
								icon={Globe}
								label="Nutzungsbedingungen"
								onPress={() => openLink("legal", env.EXPO_PUBLIC_TERMS_URL)}
							/>
						</SettingsSection>
						{linkErrors.legal ? (
							<ErrorMessage>{linkErrors.legal}</ErrorMessage>
						) : null}
					</View>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
