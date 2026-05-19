import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Mail, UserRound } from "~/components/ui/icon";
import { InsetTextField } from "~/components/ui/text-field";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
const isValidName = (value: string) => value.trim().length >= 2;

export default function ProfileScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { user, isLoading, updateProfile, verifyProfileEmailCode } = useAuth();
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

	useEffect(() => {
		if (!user) return;
		setName(user.name ?? "");
		setEmail(user.email ?? "");
	}, [user]);

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
			className="flex-1 bg-[#F6F4F7]"
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingTop: Math.max(insets.top + 28, 72),
					paddingHorizontal: 28,
					paddingBottom: Math.max(insets.bottom + 52, 82),
				}}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
				automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
				showsVerticalScrollIndicator={false}
			>
				<Header title="Profil" onBack={goBack} />

				<View className="mb-8">
					<Text
						className="font-poppins font-semibold text-[#17171C]"
						style={{ fontSize: 26, lineHeight: 32, includeFontPadding: false }}
					>
						Deine Daten
					</Text>
					<Text
						className="mt-2 font-poppins text-[#787486]"
						style={{ fontSize: 14, lineHeight: 20, includeFontPadding: false }}
					>
						Ändere deinen Namen oder deine E-Mail-Adresse.
					</Text>
				</View>

				<InsetTextField
					label="Name"
					value={name}
					onChangeText={(value) => {
						setName(value);
						setFeedback(null);
						if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
					}}
					invalid={Boolean(errors.name)}
					message={errors.name}
					placeholder="Max Mustermann"
					autoCapitalize="words"
					autoComplete="name"
					textContentType="name"
					accessory={<UserRound size={18} color="rgba(26,26,26,0.34)" />}
					className="mb-4"
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
				/>

				{isEmailVerificationPending ? (
					<View className="mt-5">
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
					className="mt-10"
					disabled={isEmailVerificationPending ? !canVerifyCode : !canSave}
					accessibilityState={{
						busy: isSaving,
						disabled: isEmailVerificationPending ? !canVerifyCode : !canSave,
					}}
					onPress={isEmailVerificationPending ? verifyEmail : saveProfile}
					style={{
						shadowColor: "#3A7BFF",
						shadowOpacity: 0.3,
						shadowRadius: 14,
						shadowOffset: { width: 0, height: 7 },
						elevation: 5,
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
			</ScrollView>
		</KeyboardAvoidingView>
	);
}
