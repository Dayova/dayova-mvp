import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
	ActivityIndicator,
	Keyboard,
	Pressable,
	type TextInput,
	View,
} from "react-native";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Eye, EyeOff } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SectionHeader } from "~/components/ui/section-header";
import { SuccessConfirmationScreen } from "~/components/ui/success-confirmation-screen";
import { Text } from "~/components/ui/text";
import { InsetTextField } from "~/components/ui/text-field";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { WarningBanner } from "~/components/ui/warning-banner";
import { useAuth } from "~/context/AuthContext";
import { useDayovaTheme } from "~/lib/theme";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

type PasswordErrors = Partial<Record<PasswordField, string>>;

function PasswordVisibilityButton({
	fieldLabel,
	visible,
	onToggle,
}: {
	fieldLabel: string;
	visible: boolean;
	onToggle: () => void;
}) {
	const { colors } = useDayovaTheme();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${fieldLabel} ${visible ? "ausblenden" : "anzeigen"}`}
			hitSlop={10}
			onPress={onToggle}
			className="h-10 w-10 items-center justify-center"
		>
			{visible ? (
				<EyeOff size={19} color={colors.secondaryText} strokeWidth={2} />
			) : (
				<Eye size={19} color={colors.secondaryText} strokeWidth={2} />
			)}
		</Pressable>
	);
}

export default function ChangePasswordScreen() {
	const router = useRouter();
	const { changePassword, isLoading } = useAuth();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
	const [newPasswordVisible, setNewPasswordVisible] = useState(false);
	const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
	const [errors, setErrors] = useState<PasswordErrors>({});
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isComplete, setIsComplete] = useState(false);
	const requestInFlightRef = useRef(false);
	const newPasswordInputRef = useRef<TextInput | null>(null);
	const confirmPasswordInputRef = useRef<TextInput | null>(null);
	const isBusy = isLoading || isSubmitting;
	const canSubmit =
		currentPassword.length > 0 &&
		newPassword.length > 0 &&
		confirmPassword.length > 0 &&
		!isBusy;

	const goBack = () => {
		if (requestInFlightRef.current || isBusy) return;
		Keyboard.dismiss();
		if (router.canGoBack()) {
			router.back();
			return;
		}
		router.replace("/settings");
	};

	const clearFieldError = (field: PasswordField) => {
		setErrorMessage(null);
		setErrors((current) => ({ ...current, [field]: undefined }));
	};

	const submitPasswordChange = async () => {
		if (requestInFlightRef.current || isBusy) return;

		const nextErrors: PasswordErrors = {};
		if (currentPassword.length === 0) {
			nextErrors.currentPassword = "Bitte gib dein aktuelles Passwort ein.";
		}
		if (newPassword.length < 8 || newPassword.trim().length === 0) {
			nextErrors.newPassword =
				"Das neue Passwort muss mindestens 8 Zeichen haben.";
		} else if (newPassword === currentPassword) {
			nextErrors.newPassword =
				"Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.";
		}
		if (newPassword !== confirmPassword) {
			nextErrors.confirmPassword =
				"Die neuen Passwörter stimmen nicht überein.";
		}

		setErrors(nextErrors);
		setErrorMessage(null);
		if (Object.keys(nextErrors).length > 0) return;

		Keyboard.dismiss();
		requestInFlightRef.current = true;
		setIsSubmitting(true);
		try {
			await changePassword({
				currentPassword,
				newPassword,
			});
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setIsComplete(true);
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: "Das Passwort konnte nicht geändert werden.",
			);
		} finally {
			requestInFlightRef.current = false;
			setIsSubmitting(false);
		}
	};

	if (isComplete) {
		return (
			<Screen>
				<ThemedStatusBar />
				<SuccessConfirmationScreen
					title="Passwort geändert"
					detailLabel="Dein neues Passwort ist aktiv."
					detailValue="Alle anderen Geräte wurden abgemeldet."
					onFinish={goBack}
				/>
			</Screen>
		);
	}

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll bottomPadding={96} keyboardShouldPersistTaps="handled">
				<Header title="Passwort ändern" onBack={goBack} />

				<SectionHeader
					title="Sicherheit"
					description="Bestätige zuerst dein aktuelles Passwort und lege danach ein neues fest."
					titleSize="sm"
				/>

				<WarningBanner
					className="mb-7"
					title="Dein Konto bleibt geschützt"
					description="Alle anderen Geräte werden aus Sicherheitsgründen abgemeldet. Dieses Gerät bleibt angemeldet."
				/>

				<InsetTextField
					label="Aktuelles Passwort"
					value={currentPassword}
					onChangeText={(value) => {
						setCurrentPassword(value);
						clearFieldError("currentPassword");
					}}
					invalid={Boolean(errors.currentPassword)}
					message={errors.currentPassword}
					placeholder="Aktuelles Passwort"
					secureTextEntry={!currentPasswordVisible}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="current-password"
					textContentType="password"
					returnKeyType="next"
					onSubmitEditing={() => newPasswordInputRef.current?.focus()}
					editable={!isBusy}
					accessory={
						<PasswordVisibilityButton
							fieldLabel="Aktuelles Passwort"
							visible={currentPasswordVisible}
							onToggle={() => setCurrentPasswordVisible((current) => !current)}
						/>
					}
					className="mb-3"
					controlClassName="min-h-[60px] rounded-[24px] px-5"
				/>

				<InsetTextField
					ref={newPasswordInputRef}
					label="Neues Passwort"
					value={newPassword}
					onChangeText={(value) => {
						setNewPassword(value);
						clearFieldError("newPassword");
					}}
					invalid={Boolean(errors.newPassword)}
					message={errors.newPassword}
					placeholder="Mindestens 8 Zeichen"
					secureTextEntry={!newPasswordVisible}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="new-password"
					textContentType="newPassword"
					returnKeyType="next"
					onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
					editable={!isBusy}
					accessory={
						<PasswordVisibilityButton
							fieldLabel="Neues Passwort"
							visible={newPasswordVisible}
							onToggle={() => setNewPasswordVisible((current) => !current)}
						/>
					}
					className="mb-3"
					controlClassName="min-h-[60px] rounded-[24px] px-5"
				/>

				<InsetTextField
					ref={confirmPasswordInputRef}
					label="Neues Passwort wiederholen"
					value={confirmPassword}
					onChangeText={(value) => {
						setConfirmPassword(value);
						clearFieldError("confirmPassword");
					}}
					invalid={Boolean(errors.confirmPassword)}
					message={errors.confirmPassword}
					placeholder="Erneut eingeben"
					secureTextEntry={!confirmPasswordVisible}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="new-password"
					textContentType="newPassword"
					returnKeyType="done"
					editable={!isBusy}
					onSubmitEditing={() => void submitPasswordChange()}
					accessory={
						<PasswordVisibilityButton
							fieldLabel="Passwortbestätigung"
							visible={confirmPasswordVisible}
							onToggle={() => setConfirmPasswordVisible((current) => !current)}
						/>
					}
					className="mb-3"
					controlClassName="min-h-[60px] rounded-[24px] px-5"
				/>

				{errorMessage ? (
					<View
						accessibilityLiveRegion="polite"
						className="mt-2 rounded-[22px] border border-destructive/20 bg-destructive/10 px-5 py-4"
					>
						<Text
							selectable
							className="font-poppins text-body-4 text-destructive"
						>
							{errorMessage}
						</Text>
					</View>
				) : null}

				<Button
					className="mt-7 h-[56px]"
					disabled={!canSubmit}
					accessibilityState={{ busy: isBusy, disabled: !canSubmit }}
					onPress={() => void submitPasswordChange()}
				>
					{isBusy ? (
						<ActivityIndicator color="#FFFFFF" />
					) : (
						<Text>Passwort ändern</Text>
					)}
				</Button>
			</ScreenScroll>
		</Screen>
	);
}
