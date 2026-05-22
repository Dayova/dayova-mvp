import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	View,
} from "react-native";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Mail, UserRound } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SectionHeader } from "~/components/ui/section-header";
import { InsetTextField } from "~/components/ui/text-field";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
const isValidName = (value: string) => value.trim().length >= 2;

export default function ProfileScreen() {
	const router = useRouter();
	const { user, isLoading, updateProfile, verifyProfileEmailCode } = useAuth();
	const userDraftKey = `${user?.clerkId ?? ""}:${user?.name ?? ""}:${user?.email ?? ""}`;
	const [draftUserKey, setDraftUserKey] = useState(userDraftKey);
	const [name, setName] = useState(user?.name ?? "");
	const [email, setEmail] = useState(user?.email ?? "");
	const [code, setCode] = useState("");
	const [errors, setErrors] = useState<{
		name?: string;
		email?: string;
		code?: string;
	}>({});
	const [feedback, setFeedback] = useState<{
		tone: "success" | "error" | "neutral";
		message: string;
	} | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isEmailVerificationPending, setIsEmailVerificationPending] =
		useState(false);

	if (draftUserKey !== userDraftKey) {
		setDraftUserKey(userDraftKey);
		setName(user?.name ?? "");
		setEmail(user?.email ?? "");
	}

	const normalizedEmail = email.trim().toLowerCase();
	const normalizedName = name.trim();
	const hasChanges = useMemo(
		() =>
			normalizedName !== (user?.name ?? "").trim() ||
			normalizedEmail !== (user?.email ?? "").trim().toLowerCase(),
		[normalizedEmail, normalizedName, user],
	);
	const canSave =
		isValidName(normalizedName) &&
		isValidEmail(normalizedEmail) &&
		hasChanges &&
		!isSaving &&
		!isLoading;
	const canVerifyCode = code.trim().length >= 4 && !isSaving && !isLoading;

	const goBack = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}

		router.replace("/settings");
	};

	const saveProfile = async () => {
		const nextErrors: typeof errors = {};
		if (!isValidName(normalizedName)) {
			nextErrors.name = "Bitte einen gültigen Namen eingeben.";
		}
		if (!isValidEmail(normalizedEmail)) {
			nextErrors.email = "Bitte eine gültige E-Mail eingeben.";
		}
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;

		setIsSaving(true);
		setFeedback(null);
		try {
			const result = await updateProfile({
				email: normalizedEmail,
				name: normalizedName,
				birthDate: user?.birthDate ?? "",
				grade: user?.grade ?? "",
				schoolType: user?.schoolType ?? "",
				state: user?.state ?? "",
			});

			if (result.status === "needs_email_verification") {
				setIsEmailVerificationPending(true);
				setCode("");
				setFeedback({ tone: "neutral", message: result.message });
				return;
			}

			setFeedback({
				tone: "success",
				message: "Dein Profil wurde gespeichert.",
			});
		} catch (error) {
			setFeedback({
				tone: "error",
				message:
					error instanceof Error
						? error.message
						: "Profil konnte nicht gespeichert werden.",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const verifyEmail = async () => {
		if (!canVerifyCode) {
			setErrors({ code: "Bitte gib den Code aus deiner E-Mail ein." });
			return;
		}

		setIsSaving(true);
		setFeedback(null);
		try {
			await verifyProfileEmailCode(code);
			setIsEmailVerificationPending(false);
			setCode("");
			setFeedback({
				tone: "success",
				message: "E-Mail wurde bestätigt und dein Profil gespeichert.",
			});
		} catch (error) {
			setFeedback({
				tone: "error",
				message:
					error instanceof Error
						? error.message
						: "E-Mail konnte nicht bestätigt werden.",
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<KeyboardAvoidingView
			className="flex-1"
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<Screen>
				<StatusBar style="dark" />
				<ScreenScroll
					bottomPadding={82}
					keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
					automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
				>
				<Header title="Profil" onBack={goBack} />

				<SectionHeader
					title="Deine Daten"
					description="Ändere deinen Namen oder deine E-Mail-Adresse."
					titleSize="sm"
				/>

				<InsetTextField
					label="Name"
					value={name}
					onChangeText={(value) => {
						setName(value);
						setFeedback(null);
						if (errors.name)
							setErrors((prev) => ({ ...prev, name: undefined }));
					}}
					invalid={Boolean(errors.name)}
					message={errors.name}
					placeholder="Max Mustermann"
					autoCapitalize="words"
					autoComplete="name"
					textContentType="name"
					accessory={<UserRound size={18} color="rgba(26,26,26,0.34)" />}
					className="mb-3"
					controlClassName="min-h-[60px] rounded-[24px] px-5"
				/>

				<InsetTextField
					label="E-Mail"
					value={email}
					onChangeText={(value) => {
						setEmail(value);
						setFeedback(null);
						setIsEmailVerificationPending(false);
						if (errors.email)
							setErrors((prev) => ({ ...prev, email: undefined }));
					}}
					invalid={Boolean(errors.email)}
					message={errors.email}
					placeholder="name@example.com"
					keyboardType="email-address"
					autoCapitalize="none"
					autoComplete="email"
					textContentType="emailAddress"
					accessory={<Mail size={18} color="rgba(26,26,26,0.34)" />}
					className="mb-3"
					controlClassName="min-h-[60px] rounded-[24px] px-5"
				/>

				{isEmailVerificationPending ? (
					<View>
						<InsetTextField
							label="Bestätigungscode"
							value={code}
							onChangeText={(value) => {
								setCode(value.replace(/\D/g, "").slice(0, 6));
								if (errors.code)
									setErrors((prev) => ({ ...prev, code: undefined }));
							}}
							invalid={Boolean(errors.code)}
							message={errors.code}
							placeholder="123456"
							keyboardType="number-pad"
							autoCapitalize="none"
							textContentType="oneTimeCode"
							controlClassName="min-h-[60px] rounded-[24px] px-5"
						/>
					</View>
				) : null}

				{feedback ? (
					<View
						className="mt-5 rounded-[22px] px-5 py-4"
						style={{
							backgroundColor:
								feedback.tone === "error"
									? "#FFF0F0"
									: feedback.tone === "success"
										? "#EEFDF5"
										: "#EEF4FF",
							borderWidth: 1,
							borderColor:
								feedback.tone === "error"
									? "#FFD1D1"
									: feedback.tone === "success"
										? "#BFF3D7"
										: "#D6E4FF",
						}}
					>
						<Text
							className="font-poppins"
							style={{
								color:
									feedback.tone === "error"
										? "#F04444"
										: feedback.tone === "success"
											? "#178C57"
											: "#3A7BFF",
								fontSize: 13,
								lineHeight: 18,
								includeFontPadding: false,
							}}
						>
							{feedback.message}
						</Text>
					</View>
				) : null}

				<Button
					className="mt-8 h-[56px]"
					disabled={isEmailVerificationPending ? !canVerifyCode : !canSave}
					accessibilityState={{
						busy: isSaving,
						disabled: isEmailVerificationPending ? !canVerifyCode : !canSave,
					}}
					onPress={isEmailVerificationPending ? verifyEmail : saveProfile}
					style={{
						shadowColor: "#3A7BFF",
						shadowOpacity: canSave || canVerifyCode ? 0.22 : 0,
						shadowRadius: 12,
						shadowOffset: { width: 0, height: 5 },
						elevation: canSave || canVerifyCode ? 4 : 0,
					}}
				>
					{isSaving ? (
						<ActivityIndicator color="#FFFFFF" />
					) : (
						<Text>
							{isEmailVerificationPending ? "E-Mail bestätigen" : "Speichern"}
						</Text>
					)}
				</Button>
				</ScreenScroll>
			</Screen>
		</KeyboardAvoidingView>
	);
}
