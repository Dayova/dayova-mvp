import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ReleaseInformationSheet } from "~/components/release-information-sheet";
import { ErrorMessage } from "~/components/ui/error-message";
import {
	Bell,
	BookOpen,
	Computer,
	CreditCard,
	Globe,
	Mail,
	Palette,
	Sparkles,
	Timer,
	UserRound,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SupportContact } from "~/components/ui/support-contact";
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
import { ThemePreferenceToggle } from "~/features/settings/theme-preference-toggle";
import { openExternalUrl } from "~/lib/open-external-url";
import { ROUTES } from "~/lib/routes";
import { env } from "~/lib/runtime-config";
import { getNativeSubscriptionManagementUrl } from "~/lib/store-subscription";
import { useDayovaTheme } from "~/lib/theme";

export default function SettingsScreen() {
	const router = useRouter();
	const { user } = useAuthSession();
	const profileName = user?.name?.trim();
	const { access } = useAccess();
	const { openAiConsentSettings, statusLabel: aiConsentStatusLabel } =
		useAiConsent();
	const { preference, setPreference } = useDayovaTheme();
	const [showReleaseInformation, setShowReleaseInformation] = useState(false);
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
		<>
			<Screen>
				<ThemedStatusBar />
				<ScreenScroll
					topPadding={104}
					bottomPadding={120}
					horizontalPadding={24}
				>
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

						<View testID="settings-support">
							<SettingsCard>
								<SupportContact context="Einstellungen">
									{({ onPress, busy, buttonRef }) => (
										<SettingsRow
											buttonRef={buttonRef}
											icon={Mail}
											label="Support kontaktieren"
											onPress={onPress}
											busy={busy}
											disabled={busy}
										/>
									)}
								</SupportContact>
							</SettingsCard>
						</View>

						<SettingsSection title="Lernen">
							<SettingsRow
								icon={Timer}
								label="Lernzeiten"
								onPress={() => router.push("/learning-times")}
							/>
							<SettingsDivider />
							<SettingsRow
								icon={BookOpen}
								label="Persönliche Fächer"
								onPress={() => router.push(ROUTES.personalSubjects)}
							/>
						</SettingsSection>

						<SettingsSection title="App">
							<SettingsRow
								icon={Computer}
								label="App-Informationen"
								onPress={() => setShowReleaseInformation(true)}
							/>
							<SettingsDivider />
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
			<ReleaseInformationSheet
				visible={showReleaseInformation}
				onClose={() => setShowReleaseInformation(false)}
			/>
		</>
	);
}
