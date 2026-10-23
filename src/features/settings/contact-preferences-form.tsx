import { useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { SelectionOptionRow } from "~/components/ui/selection-option-row";
import { Text } from "~/components/ui/text";
import { InsetTextField } from "~/components/ui/text-field";
import {
	CONTACT_CONSENT_NOTICE,
	CONTACT_CONSENT_VERSION,
	CONTACT_FEEDBACK_LABEL,
	CONTACT_NEWS_LABEL,
	type ContactChoice,
} from "~/lib/contact-preferences";
import { openExternalUrl } from "~/lib/open-external-url";
import { env } from "~/lib/runtime-config";

/** Same wording and controlled choices in onboarding and account settings. */
export function ContactPreferencesForm({
	choice,
	onChange,
	busy = false,
}: {
	choice: ContactChoice;
	onChange: (choice: ContactChoice) => void;
	busy?: boolean;
}) {
	const [linkError, setLinkError] = useState(false);
	return (
		<View className="w-full max-w-[480px] gap-4 self-center">
			<InsetTextField
				testID="contact-phone-input"
				label="Deine Telefonnummer (freiwillig)"
				placeholder="+49 1512 3456789"
				value={choice.phone}
				onChangeText={(phone) =>
					onChange({
						phone,
						feedback: false,
						news: false,
						version: CONTACT_CONSENT_VERSION,
					})
				}
				keyboardType="phone-pad"
				autoComplete="tel"
				textContentType="telephoneNumber"
				maxLength={80}
				editable={!busy}
				accessibilityHint="Bei einer Änderung der Nummer wählst du die Kontaktzwecke erneut aus."
			/>
			<SelectionOptionRow
				label="Feedback"
				description={CONTACT_FEEDBACK_LABEL}
				accessibilityLabel={CONTACT_FEEDBACK_LABEL}
				accessibilityHint=""
				accessibilityRole="checkbox"
				selected={choice.feedback}
				disabled={busy}
				onPress={() =>
					onChange({
						...choice,
						feedback: !choice.feedback,
						version: CONTACT_CONSENT_VERSION,
					})
				}
			/>
			<SelectionOptionRow
				label="Neuigkeiten zu Dayova"
				description={CONTACT_NEWS_LABEL}
				accessibilityLabel={CONTACT_NEWS_LABEL}
				accessibilityHint=""
				accessibilityRole="checkbox"
				selected={choice.news}
				disabled={busy}
				onPress={() =>
					onChange({
						...choice,
						news: !choice.news,
						version: CONTACT_CONSENT_VERSION,
					})
				}
			/>
			<Text className="text-body-4 text-secondary-text">
				{CONTACT_CONSENT_NOTICE}
			</Text>
			{!choice.feedback && !choice.news && choice.phone.trim() ? (
				<Text className="text-body-4 text-secondary-text">
					Ohne Kontaktauswahl übernehmen wir diese Nummer nicht.
				</Text>
			) : null}
			<Button
				variant="link"
				onPress={() => {
					void openExternalUrl(env.EXPO_PUBLIC_PRIVACY_URL).then((opened) =>
						setLinkError(!opened),
					);
				}}
				accessibilityLabel="Datenschutzhinweise öffnen"
			>
				<Text>Datenschutz</Text>
			</Button>
			{linkError ? (
				<ErrorMessage>
					Die Datenschutzhinweise konnten nicht geöffnet werden. Bitte versuche
					es erneut.
				</ErrorMessage>
			) : null}
		</View>
	);
}
