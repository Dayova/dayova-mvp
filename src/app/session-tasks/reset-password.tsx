import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Keyboard, type TextInput } from "react-native";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { PasswordVisibilityButton } from "~/components/ui/password-visibility-button";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SectionHeader } from "~/components/ui/section-header";
import { Text } from "~/components/ui/text";
import { InsetTextField } from "~/components/ui/text-field";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { WarningBanner } from "~/components/ui/warning-banner";
import { useAccountActions } from "~/context/AuthContext";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { PASSWORD_RESET_SUCCESS_PATH } from "~/lib/auth-routing";

export default function ForcedPasswordResetScreen() {
	const router = useRouter();
	const { completeForcedPasswordReset, isLoading } = useAccountActions();
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [confirmationVisible, setConfirmationVisible] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const confirmationRef = useRef<TextInput | null>(null);
	const actionGateRef = useRef(createAsyncActionGate());
	const isBusy = isLoading || isSubmitting;

	const submit = async () => {
		await actionGateRef.current.run(async () => {
			setError(null);
			if (password.length < 8 || password.trim().length === 0) {
				setError("Das neue Passwort muss mindestens 8 Zeichen haben.");
				return;
			}
			if (password !== confirmation) {
				setError("Die neuen Passwörter stimmen nicht überein.");
				return;
			}

			Keyboard.dismiss();
			setIsSubmitting(true);
			try {
				await completeForcedPasswordReset(password);
				router.replace(PASSWORD_RESET_SUCCESS_PATH);
			} catch (submitError) {
				setError(
					submitError instanceof Error
						? submitError.message
						: "Das neue Passwort konnte nicht gespeichert werden.",
				);
			} finally {
				setIsSubmitting(false);
			}
		});
	};

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll bottomPadding={96} keyboardShouldPersistTaps="handled">
				<Header
					title="Neues Passwort"
					showBack={false}
					onBack={() => undefined}
				/>
				<SectionHeader
					title="Konto schützen"
					description="Lege ein neues Passwort fest, bevor du Dayova weiter verwendest."
					titleSize="sm"
				/>
				<WarningBanner
					className="mb-7"
					title="Sicherheitsprüfung erforderlich"
					description="Alle anderen Geräte werden abgemeldet. Dieses Gerät bleibt angemeldet."
				/>

				<InsetTextField
					label="Neues Passwort"
					value={password}
					onChangeText={(value) => {
						setPassword(value);
						setError(null);
					}}
					placeholder="Mindestens 8 Zeichen"
					secureTextEntry={!passwordVisible}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="new-password"
					textContentType="newPassword"
					returnKeyType="next"
					onSubmitEditing={() => confirmationRef.current?.focus()}
					editable={!isBusy}
					accessory={
						<PasswordVisibilityButton
							fieldLabel="Neues Passwort"
							visible={passwordVisible}
							onToggle={() => setPasswordVisible((current) => !current)}
						/>
					}
					className="mb-3"
					controlClassName="min-h-[60px] rounded-[24px] px-5"
				/>

				<InsetTextField
					ref={confirmationRef}
					label="Neues Passwort wiederholen"
					value={confirmation}
					onChangeText={(value) => {
						setConfirmation(value);
						setError(null);
					}}
					placeholder="Erneut eingeben"
					secureTextEntry={!confirmationVisible}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="new-password"
					textContentType="newPassword"
					returnKeyType="done"
					onSubmitEditing={() => void submit()}
					editable={!isBusy}
					accessory={
						<PasswordVisibilityButton
							fieldLabel="Passwortbestätigung"
							visible={confirmationVisible}
							onToggle={() => setConfirmationVisible((current) => !current)}
						/>
					}
					className="mb-3"
					controlClassName="min-h-[60px] rounded-[24px] px-5"
				/>

				{error ? (
					<ErrorMessage className="mt-2 rounded-[22px] border border-destructive/20 bg-destructive/10 px-5 py-4">
						{error}
					</ErrorMessage>
				) : null}

				<Button
					className="mt-7 h-[56px]"
					disabled={isBusy || !password || !confirmation}
					accessibilityState={{
						busy: isBusy,
						disabled: isBusy || !password || !confirmation,
					}}
					onPress={() => void submit()}
				>
					{isBusy ? (
						<ActivityIndicator color="#FFFFFF" />
					) : (
						<Text>Passwort speichern</Text>
					)}
				</Button>
			</ScreenScroll>
		</Screen>
	);
}
