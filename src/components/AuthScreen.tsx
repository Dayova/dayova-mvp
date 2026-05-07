import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
	ChevronDown,
	CircleAlert,
	Eye,
	EyeOff,
	Mail,
	MailCheck,
	Phone,
	ShieldCheck,
	UserRound,
} from "~/components/ui/icon";
import { useEffect, useRef, useState } from "react";
import {
	Animated,
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	TextInput,
	type TextInputProps,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Cursor } from "react-native-confirmation-code-field";
import { Button } from "~/components/ui/button";
import {
	Field,
	FieldAccessory,
	FieldControl,
	FieldMessage,
	FieldTrigger,
} from "~/components/ui/field";
import { Text } from "~/components/ui/text";
import { InsetTextField } from "~/components/ui/text-field";
import { useAuth } from "~/context/AuthContext";

type Mode = "login" | "register";

type FieldErrors = {
	name?: string;
	email?: string;
	phone?: string;
	birthDate?: string;
};

type VerificationFeedback = {
	tone: "neutral" | "success" | "error";
	message: string;
};

const VERIFICATION_CODE_LENGTH = 6;
const otpAutoComplete = Platform.select<TextInputProps["autoComplete"]>({
	android: "sms-otp",
	default: "one-time-code",
});

const otpStyles = StyleSheet.create({
	root: {
		flexDirection: "row",
		gap: 8,
	},
});

const formatBirthDate = (date: Date) => {
	const day = `${date.getDate()}`.padStart(2, "0");
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const year = `${date.getFullYear()}`;
	return `${day}.${month}.${year}`;
};

const isValidBirthDate = (date: string) => {
	const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
	if (!match) return false;
	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	const dateObj = new Date(year, month - 1, day);
	const today = new Date();
	return (
		dateObj.getFullYear() === year &&
		dateObj.getMonth() === month - 1 &&
		dateObj.getDate() === day &&
		dateObj <= today
	);
};

const isCredentialError = (message: string) => {
	const normalized = message.toLowerCase();
	return (
		normalized.includes("falsch") ||
		normalized.includes("ungültig") ||
		normalized.includes("invalid") ||
		normalized.includes("benutzer nicht gefunden") ||
		normalized.includes("user not found") ||
		normalized.includes("password")
	);
};

const isInternalBackendError = (message: string) => {
	const normalized = message.toLowerCase();
	return (
		normalized.includes("convexerror") ||
		normalized.includes("server error") ||
		normalized.includes("request id") ||
		normalized.includes("uncaught error")
	);
};

function ModeButton({
	active,
	label,
	onPress,
}: {
	active: boolean;
	label: string;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity
			activeOpacity={0.85}
			onPress={onPress}
			className="min-h-[54px] flex-1 items-center justify-center rounded-full px-4"
		>
			<Text
				className={`w-full text-center font-bold font-poppins text-16 ${
					active ? "text-primary" : "text-text/56"
				}`}
				style={{ lineHeight: 22.4, includeFontPadding: false }}
			>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

function OtpCodeInput({
	value,
	onChangeText,
	disabled,
	inputRef,
}: {
	value: string;
	onChangeText: (value: string) => void;
	disabled?: boolean;
	inputRef: React.RefObject<TextInput | null>;
}) {
	useEffect(() => {
		if (!inputRef.current) return;
		inputRef.current.setNativeProps?.({
			text: value,
		});
	}, [inputRef, value]);

	return (
		<TouchableOpacity
			activeOpacity={1}
			onPress={() => inputRef.current?.focus()}
			accessibilityRole="button"
			accessibilityLabel="Bestätigungscode eingeben"
		>
			<View style={otpStyles.root}>
				{Array.from({ length: VERIFICATION_CODE_LENGTH }, (_, index) => {
					const symbol = value[index] ?? "";
					const cellKey = `verification-code-cell-${index + 1}`;
					const isFocused =
						!disabled &&
						(value.length === index ||
							(value.length === VERIFICATION_CODE_LENGTH &&
								index === VERIFICATION_CODE_LENGTH - 1));

					return (
						<View
							key={cellKey}
							className="h-[64px] flex-1 items-center justify-center rounded-[18px] bg-white"
							style={{
								borderWidth: isFocused ? 1.8 : 1.2,
								borderColor: isFocused ? "#1A1A1A" : "rgba(17,24,39,0.12)",
								shadowColor: "#111827",
								shadowOpacity: symbol ? 0.1 : 0.04,
								shadowRadius: symbol ? 14 : 8,
								shadowOffset: { width: 0, height: symbol ? 8 : 4 },
								elevation: symbol ? 4 : 2,
							}}
						>
							<Text
								className="font-poppins font-semibold text-28 text-text"
								style={{ includeFontPadding: false, lineHeight: 36 }}
							>
								{symbol || (isFocused ? <Cursor /> : null)}
							</Text>
						</View>
					);
				})}
			</View>

			<TextInput
				ref={inputRef}
				value={value}
				onChangeText={onChangeText}
				editable={!disabled}
				keyboardType="number-pad"
				textContentType="oneTimeCode"
				autoComplete={otpAutoComplete}
				autoCorrect={false}
				autoCapitalize="none"
				caretHidden
				maxLength={VERIFICATION_CODE_LENGTH}
				selectionColor="transparent"
				style={{
					position: "absolute",
					opacity: 0.01,
					width: 1,
					height: 1,
				}}
			/>
		</TouchableOpacity>
	);
}

function VerificationFeedbackPill({
	feedback,
}: {
	feedback: VerificationFeedback;
}) {
	const palette = {
		neutral: {
			background: "#F3F7FF",
			border: "rgba(58,123,255,0.14)",
			icon: "#3A7BFF",
			text: "rgba(26,26,26,0.68)",
		},
		success: {
			background: "#F1FAF5",
			border: "rgba(22,163,74,0.14)",
			icon: "#16A34A",
			text: "rgba(26,26,26,0.68)",
		},
		error: {
			background: "#FFF5F5",
			border: "rgba(239,68,68,0.16)",
			icon: "#EF4444",
			text: "#B42318",
		},
	}[feedback.tone];

	return (
		<View
			className="mt-6 flex-row items-center rounded-[20px] px-4 py-3"
			style={{
				backgroundColor: palette.background,
				borderColor: palette.border,
				borderWidth: 1,
			}}
		>
			<View className="h-6 w-6 items-center justify-center">
				{feedback.tone === "error" ? (
					<CircleAlert size={16} color={palette.icon} strokeWidth={2.2} />
				) : (
					<MailCheck size={16} color={palette.icon} strokeWidth={2.2} />
				)}
			</View>
			<Text
				className="ml-2.5 flex-1 font-poppins text-13"
				style={{
					color: palette.text,
					includeFontPadding: false,
					lineHeight: 18.2,
				}}
			>
				{feedback.message}
			</Text>
		</View>
	);
}

export default function AuthScreen({ initialMode }: { initialMode: Mode }) {
	const insets = useSafeAreaInsets();
	const {
		login,
		register: registerUser,
		verifyEmailCode,
		resendVerification,
		pendingVerification,
		isLoading,
	} = useAuth();

	const [mode, setMode] = useState<Mode>(initialMode);
	const [tabWidth, setTabWidth] = useState(0);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [birthDateValue, setBirthDateValue] = useState<Date | null>(null);
	const [password, setPassword] = useState("");
	const [verificationCode, setVerificationCode] = useState("");
	const [verificationFeedback, setVerificationFeedback] =
		useState<VerificationFeedback | null>(null);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [submitError, setSubmitError] = useState("");
	const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
	const [tabProgress] = useState(
		() => new Animated.Value(initialMode === "login" ? 1 : 0),
	);
	const formScrollRef = useRef<ScrollView | null>(null);
	const otpInputRef = useRef<TextInput | null>(null);
	const birthDateFieldY = useRef(0);

	const isRegisterMode = mode === "register";
	const isVerificationPending = Boolean(pendingVerification);
	const isOtpKeyboardVisible = isVerificationPending && isKeyboardVisible;
	const tabIndicatorTranslateX = tabProgress.interpolate({
		inputRange: [0, 1],
		outputRange: [0, tabWidth],
	});

	useEffect(() => {
		if (!isVerificationPending) return;
		const focusTimer = setTimeout(() => {
			otpInputRef.current?.focus();
		}, 280);
		return () => clearTimeout(focusTimer);
	}, [isVerificationPending]);

	useEffect(() => {
		if (!isOtpKeyboardVisible) return;
		const refocusTimer = setTimeout(() => {
			otpInputRef.current?.focus();
		}, 80);
		return () => clearTimeout(refocusTimer);
	}, [isOtpKeyboardVisible]);

	useEffect(() => {
		if (!isVerificationPending) return;

		const showEvent =
			Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent =
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
		const showSubscription = Keyboard.addListener(showEvent, () => {
			setIsKeyboardVisible(true);
		});
		const hideSubscription = Keyboard.addListener(hideEvent, () => {
			setIsKeyboardVisible(false);
		});

		return () => {
			showSubscription.remove();
			hideSubscription.remove();
		};
	}, [isVerificationPending]);

	const switchMode = (next: Mode) => {
		if (next === mode) return;
		if (isVerificationPending) return;
		Keyboard.dismiss();
		setShowBirthDatePicker(false);
		setSubmitError("");
		setErrors({});
		setMode(next);
		Animated.spring(tabProgress, {
			toValue: next === "login" ? 1 : 0,
			damping: 18,
			mass: 0.8,
			stiffness: 180,
			useNativeDriver: true,
		}).start();
	};

	const updatePassword = (nextValue: string) => {
		setPassword(nextValue);
		if (submitError) setSubmitError("");
	};

	const updateVerificationCode = (nextValue: string) => {
		setVerificationCode(
			nextValue.replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH),
		);
		if (verificationFeedback?.tone === "error") setVerificationFeedback(null);
	};

	const togglePasswordVisibility = () =>
		setPasswordVisible((current) => !current);

	const closeBirthDatePicker = () => setShowBirthDatePicker(false);

	const openBirthDatePicker = () => {
		Keyboard.dismiss();
		setTimeout(() => {
			formScrollRef.current?.scrollTo({
				y: Math.max(birthDateFieldY.current - 24, 0),
				animated: true,
			});
			setShowBirthDatePicker(true);
		}, 80);
	};

	const handleBirthDateChange = (
		event: DateTimePickerEvent,
		selectedDate?: Date,
	) => {
		if (Platform.OS === "android") setShowBirthDatePicker(false);
		if (event.type === "dismissed" || !selectedDate) return;
		setBirthDateValue(selectedDate);
		if (errors.birthDate) {
			setErrors((prev) => ({ ...prev, birthDate: undefined }));
		}
	};

	const handleLogin = async () => {
		try {
			setSubmitError("");
			const result = await login({ email: email.trim(), password });
		if (result.status === "complete") {
			router.replace("/home");
			return;
		}
		setIsKeyboardVisible(false);
		setVerificationCode("");
		setVerificationFeedback({ tone: "neutral", message: result.message });
	} catch (error) {
			const message =
				error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.";
			if (isCredentialError(message)) {
				setSubmitError("E-Mail oder Passwort ist falsch.");
				return;
			}
			setSubmitError(
				isInternalBackendError(message)
					? "Anmeldung fehlgeschlagen. Bitte versuche es erneut."
					: message,
			);
		}
	};

	const handleRegister = async () => {
		const nextErrors: FieldErrors = {};
		const trimmedName = name.trim();
		const trimmedEmail = email.trim().toLowerCase();
		const trimmedPhone = phone.trim();
		const trimmedBirthDate = birthDateValue
			? formatBirthDate(birthDateValue)
			: "";

		if (trimmedName.length < 2 || !/^[A-Za-zÀ-ÿ' -]+$/.test(trimmedName)) {
			nextErrors.name = "Bitte einen gültigen Namen eingeben.";
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
			nextErrors.email = "Bitte eine gültige E-Mail eingeben.";
		}
		if (!/^\+?[0-9()\-.\s]{7,20}$/.test(trimmedPhone)) {
			nextErrors.phone = "Bitte eine gültige Telefonnummer eingeben.";
		}
		if (!isValidBirthDate(trimmedBirthDate)) {
			nextErrors.birthDate =
				"Bitte ein gültiges Geburtsdatum (TT.MM.JJJJ) eingeben.";
		}

		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			setSubmitError("");
			return;
		}

		try {
			setSubmitError("");
			const result = await registerUser({
				name: trimmedName,
				email: trimmedEmail,
				phone: trimmedPhone,
				birthDate: trimmedBirthDate,
				password,
			});
			if (result.status === "complete") {
				router.replace("/home");
				return;
			}
			setVerificationCode("");
			setVerificationFeedback({ tone: "neutral", message: result.message });
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Registrierung fehlgeschlagen.";
			setSubmitError(
				isInternalBackendError(message)
					? "Registrierung fehlgeschlagen. Bitte versuche es erneut."
					: message,
			);
		}
	};

	const handleVerifyEmailCode = async () => {
		try {
			setVerificationFeedback(null);
			const result = await verifyEmailCode(verificationCode);
			if (result.status === "complete") {
				router.replace("/home");
				return;
			}
			setVerificationFeedback({ tone: "neutral", message: result.message });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Bestätigung fehlgeschlagen.";
			setVerificationFeedback({ tone: "error", message });
		}
	};

	const handleResendVerification = async () => {
		try {
			setVerificationFeedback(null);
			await resendVerification();
			setVerificationCode("");
			setVerificationFeedback({
				tone: "success",
				message: `Ein neuer Code wurde an ${pendingVerification?.email} gesendet.`,
			});
			otpInputRef.current?.focus();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Code konnte nicht gesendet werden.";
			setVerificationFeedback({ tone: "error", message });
		}
	};

	if (isVerificationPending) {
		const emailAddress = pendingVerification?.email ?? "deine E-Mail-Adresse";
		const canSubmitCode =
			verificationCode.length === VERIFICATION_CODE_LENGTH && !isLoading;
		const otpTopPadding = isOtpKeyboardVisible
			? Math.max(insets.top + 16, 28)
			: Math.max(insets.top + 40, 72);
		const otpCardMarginTop = isOtpKeyboardVisible ? 18 : 40;
		const otpCardPaddingTop = isOtpKeyboardVisible ? 24 : 32;
		const otpContentPaddingBottom = isOtpKeyboardVisible ? 24 : 36;
		const otpIconSize = isOtpKeyboardVisible ? 64 : 80;
		const otpTitleMarginTop = isOtpKeyboardVisible ? 20 : 28;
		const otpFieldMarginTop = isOtpKeyboardVisible ? 8 : 16;
		const otpButtonMarginTop = isOtpKeyboardVisible ? 28 : 40;

		return (
			<KeyboardAvoidingView className="flex-1 bg-black">
				<StatusBar style="light" />

				<View className="flex-1 bg-black" style={{ paddingTop: otpTopPadding }}>
					<View className="items-center px-8">
						<View className="flex-row items-center">
							<Image
								source={require("../../assets/dayova-logo.png")}
								style={{ width: 72, height: 72 }}
								resizeMode="contain"
							/>
							<Text
								className="-ml-2 font-bold font-poppins text-32 text-white"
								style={{ includeFontPadding: false, lineHeight: 40 }}
							>
								Dayova
							</Text>
						</View>
					</View>

					<View
						className="flex-1 rounded-t-[36px] bg-background px-8"
						style={{
							marginTop: otpCardMarginTop,
							paddingTop: otpCardPaddingTop,
						}}
					>
						<ScrollView
							contentContainerStyle={{
								flexGrow: 1,
								paddingBottom: otpContentPaddingBottom,
							}}
							keyboardShouldPersistTaps="handled"
							showsVerticalScrollIndicator={false}
							keyboardDismissMode={
								Platform.OS === "ios" ? "interactive" : "on-drag"
							}
							automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
						>
							<View className="items-center">
								<View
									className="items-center justify-center rounded-[28px] bg-[#F3F7FF]"
									style={{
										width: otpIconSize,
										height: otpIconSize,
										borderColor: "rgba(58,123,255,0.12)",
										borderWidth: 1,
									}}
								>
									<ShieldCheck size={34} color="#3A7BFF" strokeWidth={2.1} />
								</View>

								<Text
									className="text-center font-bold font-poppins text-28 text-text"
									style={{
										marginTop: otpTitleMarginTop,
										includeFontPadding: false,
										lineHeight: 34,
									}}
								>
									E-Mail bestätigen
								</Text>
								<Text
									className="mt-3 text-center font-poppins text-14 text-text/60"
									style={{ lineHeight: 21, includeFontPadding: false }}
								>
									Gib den 6-stelligen Code ein, den wir an{" "}
									<Text className="font-bold font-poppins text-14 text-text">
										{emailAddress}
									</Text>{" "}
									gesendet haben.
								</Text>
							</View>

							<View style={{ marginTop: otpFieldMarginTop }}>
								<OtpCodeInput
									value={verificationCode}
									onChangeText={updateVerificationCode}
									disabled={isLoading}
									inputRef={otpInputRef}
								/>
							</View>

							{verificationFeedback ? (
								<VerificationFeedbackPill feedback={verificationFeedback} />
							) : null}

							<View className="mt-8 flex-row justify-center">
								<Text className="font-poppins text-14 text-text/52">
									Kein Code angekommen?
								</Text>
								<TouchableOpacity
									activeOpacity={0.72}
									onPress={handleResendVerification}
									disabled={isLoading}
									className="ml-1"
								>
									<Text className="font-bold font-poppins text-14 text-primary">
										Erneut senden
									</Text>
								</TouchableOpacity>
							</View>

							<Button
								onPress={handleVerifyEmailCode}
								disabled={!canSubmitCode}
								className="mt-10"
								style={{ marginTop: otpButtonMarginTop }}
							>
								<Text>{isLoading ? "Prüft..." : "Code bestätigen"}</Text>
							</Button>
						</ScrollView>
					</View>
				</View>
			</KeyboardAvoidingView>
		);
	}

	return (
		<KeyboardAvoidingView className="flex-1 bg-black">
			<StatusBar style="light" />

			<View
				className="bg-black px-8 pb-16"
				style={{ paddingTop: Math.max(insets.top + 44, 88) }}
			>
				<View className="items-center justify-center">
					<View className="flex-row items-center">
						<Image
							source={require("../../assets/dayova-logo.png")}
							style={{ width: 108, height: 108 }}
							resizeMode="contain"
						/>
						<Text
							className="-ml-3 font-bold font-poppins text-white"
							style={{ fontSize: 56, lineHeight: 68 }}
						>
							Dayova
						</Text>
					</View>
				</View>
			</View>

			<View className="-mt-8 flex-1 rounded-t-[34px] bg-background px-8 pt-6">
				<View
					className="mb-6 rounded-full bg-[#EEF2F7] p-1.5"
					style={{
						minHeight: 60,
						borderWidth: 1,
						borderColor: "rgba(17,24,39,0.06)",
						shadowColor: "#111827",
						shadowOpacity: 0.06,
						shadowRadius: 10,
						shadowOffset: { width: 0, height: 5 },
						elevation: 2,
					}}
				>
					<View
						className="min-h-[54px] flex-row rounded-full"
						onLayout={(event) => {
							setTabWidth(event.nativeEvent.layout.width / 2);
						}}
					>
						{tabWidth > 0 ? (
							<Animated.View
								pointerEvents="none"
								className="absolute rounded-full bg-white"
								style={{
									bottom: 2,
									left: 2,
									top: 2,
									width: Math.max(tabWidth - 4, 0),
									transform: [{ translateX: tabIndicatorTranslateX }],
									shadowColor: "#111827",
									shadowOpacity: 0.08,
									shadowRadius: 8,
									shadowOffset: { width: 0, height: 3 },
									elevation: 3,
								}}
							/>
						) : null}
						<ModeButton
							active={isRegisterMode}
							label="Registrieren"
							onPress={() => switchMode("register")}
						/>
						<ModeButton
							active={!isRegisterMode}
							label="Anmelden"
							onPress={() => switchMode("login")}
						/>
					</View>
				</View>

				<ScrollView
					ref={formScrollRef}
					className="-mx-2 flex-1"
					contentContainerStyle={{
						flexGrow: 1,
						paddingBottom: 40,
						paddingHorizontal: 8,
					}}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode={
						Platform.OS === "ios" ? "interactive" : "on-drag"
					}
					automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
				>
					{isRegisterMode ? (
						<InsetTextField
							label="Name"
							invalid={Boolean(errors.name)}
							message={errors.name}
							accessory={<UserRound size={18} color="rgba(26,26,26,0.34)" />}
							value={name}
							onChangeText={(value) => {
								setName(value);
								if (errors.name) {
									setErrors((prev) => ({ ...prev, name: undefined }));
								}
							}}
							onFocus={closeBirthDatePicker}
							placeholder="Max Mustermann"
							autoCapitalize="words"
							autoComplete="name"
							textContentType="name"
						/>
					) : null}
					<InsetTextField
						label="E-Mail"
						invalid={isRegisterMode && Boolean(errors.email)}
						message={isRegisterMode ? errors.email : undefined}
						accessory={<Mail size={18} color="rgba(26,26,26,0.34)" />}
						value={email}
						onChangeText={(value) => {
							setEmail(value);
							if (submitError) setSubmitError("");
							if (errors.email) {
								setErrors((prev) => ({ ...prev, email: undefined }));
							}
						}}
						onFocus={closeBirthDatePicker}
						placeholder="name@example.com"
						keyboardType="email-address"
						autoCapitalize="none"
						autoComplete="email"
						textContentType="emailAddress"
					/>

					{isRegisterMode ? (
						<InsetTextField
							label="Telefon"
							invalid={Boolean(errors.phone)}
							message={errors.phone}
							accessory={<Phone size={18} color="rgba(26,26,26,0.34)" />}
							value={phone}
							onChangeText={(value) => {
								setPhone(value);
								if (errors.phone) {
									setErrors((prev) => ({ ...prev, phone: undefined }));
								}
							}}
							onFocus={closeBirthDatePicker}
							placeholder="+49 123 4567890"
							keyboardType="phone-pad"
							autoCapitalize="none"
							autoComplete="tel"
							textContentType="telephoneNumber"
						/>
					) : null}

					{isRegisterMode ? (
						<Field
							onLayout={(event) => {
								birthDateFieldY.current = event.nativeEvent.layout.y;
							}}
						>
							<FieldTrigger
								activeOpacity={0.82}
								onPress={openBirthDatePicker}
								invalid={Boolean(errors.birthDate)}
								className="min-h-[74px] items-start rounded-[22px] px-5 pt-3 pb-3"
							>
								<View className="flex-1">
									<Text className="font-poppins text-12 text-text/42 leading-4">
										Geburtsdatum
									</Text>
									<Text
										className={`mt-1 font-poppins text-16 ${
											birthDateValue ? "text-text" : "text-text/36"
										}`}
									>
										{birthDateValue
											? formatBirthDate(birthDateValue)
											: "Geburtsdatum auswählen"}
									</Text>
								</View>
								<FieldAccessory className="ml-3 self-center">
									<ChevronDown
										size={18}
										color="rgba(26,26,26,0.42)"
										strokeWidth={2.2}
									/>
								</FieldAccessory>
							</FieldTrigger>
							{errors.birthDate ? (
								<FieldMessage>{errors.birthDate}</FieldMessage>
							) : null}
						</Field>
					) : null}

					<Field>
						<FieldControl className="min-h-[74px] items-start rounded-[22px] px-5 pt-3 pb-3">
							<View className="flex-1">
								<Text className="font-poppins text-12 text-text/42 leading-4">
									Passwort
								</Text>
								{/*
                  Keep this as a native TextInput instead of InsetTextField/Input.
                  The shared Input's Poppins font metrics make hidden secure text
                  render invisible on device while the cursor remains visible.
                  Native secureTextEntry is still required for correct editing,
                  paste, keyboard, accessibility, and password-manager behavior.
                */}
								<TextInput
									accessibilityLabel="Passwort"
									value={password}
									onChangeText={updatePassword}
									onFocus={closeBirthDatePicker}
									placeholder="••••••••"
									secureTextEntry={!passwordVisible}
									autoCapitalize="none"
									autoCorrect={false}
									autoComplete={
										isRegisterMode ? "new-password" : "current-password"
									}
									textContentType={isRegisterMode ? "newPassword" : "password"}
									placeholderTextColor="rgba(26,26,26,0.36)"
									selectionColor="#3A7BFF"
									style={{
										color: "#1A1A1A",
										fontSize: 16,
										height: 30,
										margin: 0,
										marginTop: 4,
										paddingHorizontal: 0,
										paddingVertical: 0,
										...Platform.select({
											android: {
												fontFamily: "sans-serif",
												includeFontPadding: true,
												textAlignVertical: "center" as const,
											},
										}),
									}}
								/>
							</View>
							<FieldAccessory className="ml-3 self-center">
								<TouchableOpacity
									activeOpacity={0.75}
									onPress={togglePasswordVisibility}
								>
									{passwordVisible ? (
										<Eye size={18} color="rgba(26,26,26,0.34)" />
									) : (
										<EyeOff size={18} color="rgba(26,26,26,0.34)" />
									)}
								</TouchableOpacity>
							</FieldAccessory>
						</FieldControl>
						{submitError ? <FieldMessage>{submitError}</FieldMessage> : null}
					</Field>

					<View
						className="mt-2 mb-6 rounded-[20px] bg-[#F7F8FA] px-[18px] py-4"
						style={{
							borderWidth: 1,
							borderColor: "rgba(17,24,39,0.05)",
						}}
					>
						<View className="flex-row items-center">
							<View className="h-6 w-6 items-center justify-center">
								<CircleAlert size={16} color="#3A7BFF" strokeWidth={2.1} />
							</View>
							<Text
								className="ml-2.5 flex-1 font-poppins text-14 text-text/62"
								style={{ lineHeight: 19.6, includeFontPadding: false }}
							>
								{isRegisterMode
									? "Mit der Registrierung erstellst du dein persönliches Lernprofil."
									: "Falls etwas nicht klappt, prüfe zuerst E-Mail-Adresse und Passwort."}
							</Text>
						</View>
					</View>

					<Button
						onPress={isRegisterMode ? handleRegister : handleLogin}
						disabled={isLoading}
						className="mt-1"
					>
						<Text>
							{isLoading ? "Lädt..." : isRegisterMode ? "Weiter" : "Anmelden"}
						</Text>
					</Button>

					<View className="pt-5 pb-2">
						<Text className="text-center font-poppins text-12 text-text/46">
							{isRegisterMode
								? "Schon ein Konto? Oben kannst du direkt zur Anmeldung wechseln."
								: "Noch kein Konto? Wechsle oben zur Registrierung."}
						</Text>
					</View>
				</ScrollView>
			</View>

			{showBirthDatePicker && isRegisterMode && Platform.OS === "ios" ? (
				<View className="absolute inset-0 z-50 justify-end">
					<TouchableOpacity
						className="absolute inset-0 bg-black/28"
						activeOpacity={1}
						onPress={closeBirthDatePicker}
					/>
					<View className="rounded-t-[32px] bg-white px-4 pt-3 pb-7">
						<View className="mb-1 flex-row justify-end">
							<TouchableOpacity
								onPress={closeBirthDatePicker}
								className="px-3 py-2"
							>
								<Text className="font-bold font-poppins text-16 text-primary">
									Fertig
								</Text>
							</TouchableOpacity>
						</View>
						<DateTimePicker
							value={birthDateValue ?? new Date(2000, 0, 1)}
							mode="date"
							display="spinner"
							maximumDate={new Date()}
							onChange={handleBirthDateChange}
						/>
					</View>
				</View>
			) : null}

			{showBirthDatePicker && isRegisterMode && Platform.OS === "android" ? (
				<DateTimePicker
					value={birthDateValue ?? new Date(2000, 0, 1)}
					mode="date"
					display="default"
					maximumDate={new Date()}
					onChange={handleBirthDateChange}
				/>
			) : null}
		</KeyboardAvoidingView>
	);
}
