import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ReleaseInformationSheet } from "~/components/release-information-sheet";
import { ErrorMessage } from "~/components/ui/error-message";
import { CreditCard, Mail } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SupportContact } from "~/components/ui/support-contact";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAccess } from "~/context/AccessContext";
import { useAiConsent } from "~/context/AiConsentContext";
import { useAuthSession } from "~/context/AuthContext";
import { SettingsContent } from "~/features/settings/settings-content";
import { SettingsCard, SettingsRow } from "~/features/settings/settings-list";
import { openExternalUrl } from "~/lib/open-external-url";
import { ROUTES } from "~/lib/routes";
import { env } from "~/lib/runtime-config";
import { getNativeSubscriptionManagementUrl } from "~/lib/store-subscription";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";

export default function SettingsScreen() {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();
	const { user } = useAuthSession();
	const profileName = user?.name?.trim();
	const { access } = useAccess();
	const { openAiConsentSettings, statusLabel: aiConsentStatusLabel } =
		useAiConsent();

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

	const subscriptionCard = (
		<View className="gap-3" testID="settings-subscription">
			<SettingsCard>
				{access?.state === "trial" ? (
					<SettingsRow
						icon={CreditCard}
						label="Dayova abonnieren"
						onPress={() => {
							trackFeature("settings.subscription_opened");
							router.push("/subscription");
						}}
					/>
				) : (
					<SettingsRow
						icon={CreditCard}
						label="Dayova"
						accessibilityLabel={`Dayova, ${nativeManagementUrl ? "Abo im Store verwalten" : "Hilfe zum Abo"}`}
						description={
							nativeManagementUrl ? "Abo im Store verwalten" : "Hilfe zum Abo"
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
	);

	return (
		<>
			<Screen>
				<ThemedStatusBar />
				<ScreenScroll
					topPadding={104}
					bottomPadding={120}
					horizontalPadding={24}
				>
					<SettingsContent
						profileName={profileName}
						support={
							<View testID="settings-support">
								<SettingsCard>
									<SupportContact context="Einstellungen">
										{({ onPress, busy, buttonRef }) => (
											<SettingsRow
												buttonRef={buttonRef}
												icon={Mail}
												label="Support kontaktieren"
												onPress={() => {
													trackFeature("settings.support_opened");
													onPress();
												}}
												busy={busy}
												disabled={busy}
											/>
										)}
									</SupportContact>
								</SettingsCard>
							</View>
						}
						subscriptionCard={subscriptionCard}
						isStoreSubscriber={isStoreSubscriber}
						onProfile={() => {
							trackFeature("settings.profile_opened");
							router.push("/profile");
						}}
						onLearningTimes={() => {
							trackFeature("settings.learning_times_opened");
							router.push("/learning-times");
						}}
						onSubjects={() => router.push(ROUTES.personalSubjects)}
						onNotifications={() => {
							trackFeature("settings.notifications_opened");
							router.push("/notification-settings");
						}}
						onAppInformation={() => {
							trackFeature("settings.release_information_opened");
							setShowReleaseInformation(true);
						}}
						onPrivacy={() => {
							trackFeature("settings.privacy_opened");
							openLink("legal", env.EXPO_PUBLIC_PRIVACY_URL);
						}}
						onTerms={() => {
							trackFeature("settings.terms_opened");
							openLink("legal", env.EXPO_PUBLIC_TERMS_URL);
						}}
						openAiConsentSettings={() => {
							trackFeature("settings.ai_privacy_opened");
							openAiConsentSettings();
						}}
						onThemeChanged={() =>
							trackFeature("settings.theme_changed", "succeeded")
						}
						aiConsentStatusLabel={aiConsentStatusLabel}
						legalError={linkErrors.legal}
					/>
				</ScreenScroll>
			</Screen>
			<ReleaseInformationSheet
				visible={showReleaseInformation}
				onClose={() => setShowReleaseInformation(false)}
			/>
		</>
	);
}
