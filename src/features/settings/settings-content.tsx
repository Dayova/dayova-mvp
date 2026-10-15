import type { ReactNode } from "react";
import { View } from "react-native";
import { ErrorMessage } from "~/components/ui/error-message";
import {
	Bell,
	BookOpen,
	Computer,
	Globe,
	Palette,
	Sparkles,
	Timer,
	UserRound,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import {
	SettingsCard,
	SettingsDivider,
	SettingsRow,
	SettingsSection,
} from "./settings-list";
import { ThemePreferenceToggle } from "./theme-preference-toggle";

/** Shared settings hierarchy; account behavior belongs to the caller. */
export function SettingsContent({
	profileName,
	support,
	learning,
	subscriptionCard,
	isStoreSubscriber,
	onProfile,
	onLearningTimes,
	onSubjects,
	onNotifications,
	onAppInformation,
	onPrivacy,
	onTerms,
	openAiConsentSettings,
	aiConsentStatusLabel,
	legalError,
}: {
	profileName?: string;
	support: ReactNode;
	learning?: ReactNode;
	subscriptionCard: ReactNode;
	isStoreSubscriber: boolean;
	aiConsentStatusLabel: string;
	legalError?: string;
	onProfile: () => void;
	onLearningTimes: () => void;
	onSubjects: () => void;
	onNotifications: () => void;
	onAppInformation: () => void;
	onPrivacy: () => void;
	onTerms: () => void;
	openAiConsentSettings: () => void;
}) {
	const { preference, setPreference } = useDayovaTheme();
	return (
		<View className="gap-7">
			<SettingsCard>
				<SettingsRow
					icon={UserRound}
					label={profileName || "Profil & Konto"}
					description={profileName ? "Profil & Konto" : undefined}
					accessibilityLabel={
						profileName ? `${profileName}, Profil & Konto` : "Profil & Konto"
					}
					onPress={() => onProfile()}
				/>
			</SettingsCard>

			{support}

			{!isStoreSubscriber ? subscriptionCard : null}

			{learning ?? (
				<SettingsSection title="Lernen">
					<SettingsRow
						icon={Timer}
						label="Lernzeiten"
						onPress={() => onLearningTimes()}
					/>
					<SettingsDivider />
					<SettingsRow
						icon={BookOpen}
						label="Persönliche Fächer"
						onPress={() => onSubjects()}
					/>
				</SettingsSection>
			)}

			<SettingsSection title="App">
				<SettingsRow
					icon={Computer}
					label="App-Informationen"
					onPress={() => onAppInformation()}
				/>
				<SettingsDivider />
				<SettingsRow
					icon={Bell}
					label="Mitteilungen"
					onPress={() => onNotifications()}
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

			{isStoreSubscriber ? subscriptionCard : null}

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
						onPress={() => onPrivacy()}
					/>
					<SettingsDivider />
					<SettingsRow
						icon={Globe}
						label="Nutzungsbedingungen"
						onPress={() => onTerms()}
					/>
				</SettingsSection>
				{legalError ? <ErrorMessage>{legalError}</ErrorMessage> : null}
			</View>
		</View>
	);
}
