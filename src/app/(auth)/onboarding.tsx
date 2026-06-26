import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ComponentProps, useCallback, useEffect, useState } from "react";
import {
	Image,
	Keyboard,
	Platform,
	TouchableOpacity,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mascot } from "~/components/Mascot";
import { BackButton, Button } from "~/components/ui/button";
import {
	type DateTimePickerEvent,
	DateTimePickerSheet,
} from "~/components/ui/date-time-picker-sheet";
import {
	Field,
	FieldAccessory,
	FieldLabel,
	FieldMessage,
	FieldTrigger,
} from "~/components/ui/field";
import { ChevronDown } from "~/components/ui/icon";
import { KeyboardSafeScrollView } from "~/components/ui/keyboard-safe-scroll-view";
import { Text } from "~/components/ui/text";
import { InsetTextField } from "~/components/ui/text-field";
import { useAuth } from "~/context/AuthContext";
import { useOnboarding } from "~/context/OnboardingContext";
import { useBackIntent } from "~/lib/navigation";

type MascotPose = ComponentProps<typeof Mascot>["pose"];

const keyboardScrollContentStyle = { flexGrow: 1 } satisfies ViewStyle;

type IntroStep = {
	kind: "intro";
	title: string;
	description: string;
};

type InfoStep = {
	kind: "info";
	title: string;
	description: string;
};

type SelectStep = {
	kind: "select";
	title: string;
	description?: string;
	field: "studyTime" | "strength" | "challenge" | "goal";
	options: readonly string[];
};

type InputStep = {
	kind: "input";
	title: string;
	description?: string;
	field: "state";
	label: string;
	placeholder: string;
};

type ProfileInputStep = {
	kind: "profileInput";
	title: string;
	description?: string;
	field: "name" | "email" | "birthDate";
	label: string;
	placeholder?: string;
};

type PasswordStep = {
	kind: "password";
	title: string;
	description?: string;
};

type FlowStep =
	| IntroStep
	| InfoStep
	| SelectStep
	| InputStep
	| ProfileInputStep
	| PasswordStep;

const FLOW_STEPS: readonly FlowStep[] = [
	{
		kind: "intro",
		title: "Keine Motivation.\nKein Plan. Zu viel Stress?",
		description:
			"Prokrastination, Ablenkung und Unklarheit halten dich davon ab, wirklich voranzukommen.",
	},
	{
		kind: "intro",
		title: "Kommt dir das bekannt vor?",
		description:
			"Zu viele Aufgaben, kein klarer Überblick und oft die Frage: Was soll ich heute eigentlich lernen?",
	},
	{
		kind: "intro",
		title: "Dayova bringt dich ans Ziel.",
		description:
			"Individuell, strukturiert und motivierend: mehr Fortschritt, weniger Stress und echte Erfolge.",
	},
	{
		kind: "select",
		title: "Wie viel lernst du aktuell pro Tag?",
		field: "studyTime",
		options: [
			"Unter 30 Min.",
			"30 bis 60 Min.",
			"1 bis 2 Stunden",
			"Mehr als 2 Stunden",
		],
	},
	{
		kind: "info",
		title: "Schon 30 Minuten am Tag können viel bewirken.",
		description:
			"Regelmäßige kurze Lerneinheiten helfen dir, ohne zusätzlichen Stress dranzubleiben.",
	},
	{
		kind: "select",
		title: "Wo liegen deine Stärken?",
		field: "strength",
		options: [
			"Sprachen",
			"Mathematik",
			"Naturwissenschaften",
			"Kreative Fächer",
		],
	},
	{
		kind: "select",
		title: "Was sind deine größten Baustellen in der Schule?",
		field: "challenge",
		options: ["Konzentration", "Motivation", "Organisation", "Prüfungsstress"],
	},
	{
		kind: "select",
		title: "Was möchtest du mit uns erreichen?",
		field: "goal",
		options: [
			"Bessere Noten",
			"Mehr Struktur",
			"Weniger Stress",
			"Konstant dranbleiben",
		],
	},
	{
		kind: "info",
		title: "Gute Nachricht: Kleine Routinen helfen.",
		description:
			"Ein klarer Plan ist oft wichtiger als besonders lange Lernsessions.",
	},
	{
		kind: "input",
		title: "Aus welchem Bundesland kommst du?",
		field: "state",
		label: "Bundesland",
		placeholder: "z. B. Bayern",
	},
	{
		kind: "profileInput",
		title: "Wie heißt du?",
		description:
			"Damit wir dich persönlich ansprechen können, brauchen wir zuerst deinen Namen.",
		field: "name",
		label: "Name",
		placeholder: "Max Mustermann",
	},
	{
		kind: "profileInput",
		title: "Wie lautet deine E-Mail?",
		description:
			"Über diese Adresse bestätigen wir dein Konto und halten deinen Fortschritt sicher fest.",
		field: "email",
		label: "E-Mail",
		placeholder: "name@example.com",
	},
	{
		kind: "profileInput",
		title: "Wie alt bist du?",
		description:
			"Dein Alter hilft uns, den Lernplan besser auf dich abzustimmen.",
		field: "birthDate",
		label: "Alter",
	},
	{
		kind: "password",
		title: "Lege dein Passwort fest",
		description:
			"Ein sicheres Passwort schützt dein Konto und bringt dich direkt zum Start.",
	},
] as const;

const INTRO_STEP_COUNT = 3;
const QUESTION_STEP_COUNT = FLOW_STEPS.length - INTRO_STEP_COUNT;
const INTRO_PROGRESS_KEYS = [
	"intro-progress-1",
	"intro-progress-2",
	"intro-progress-3",
];

type StepErrors = {
	name?: string;
	email?: string;
	birthDate?: string;
	password?: string;
	submit?: string;
};

const formatBirthDate = (date: Date) => {
	const day = `${date.getDate()}`.padStart(2, "0");
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const year = `${date.getFullYear()}`;
	return `${day}.${month}.${year}`;
};

const parseBirthDate = (value: string) => {
	const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
	if (!match) return null;
	const parsed = new Date(
		Number(match[3]),
		Number(match[2]) - 1,
		Number(match[1]),
	);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getAgeFromBirthDate = (date: Date) => {
	const today = new Date();
	let age = today.getFullYear() - date.getFullYear();
	const hadBirthdayThisYear =
		today.getMonth() > date.getMonth() ||
		(today.getMonth() === date.getMonth() && today.getDate() >= date.getDate());
	if (!hadBirthdayThisYear) age -= 1;
	return Math.max(age, 0);
};

const isValidName = (value: string) =>
	value.length >= 2 && /^[A-Za-zÀ-ÿ' -]+$/.test(value);

const isValidEmail = (value: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidBirthDate = (date: Date | null) => {
	if (!date) return false;
	const today = new Date();
	return date <= today && getAgeFromBirthDate(date) >= 6;
};

const isValidPassword = (value: string) => value.trim().length >= 8;

const getMascotPose = (step: FlowStep, index: number): MascotPose => {
	if (step.kind === "intro") {
		if (index === 0) return "thinking";
		if (index === 1) return "curious";
		return "celebrating";
	}

	if (step.kind === "info") return "encouraging";
	if (step.kind === "input") return "curious";
	if (step.kind === "password") return "secure";
	if (step.kind === "profileInput") {
		if (step.field === "birthDate") return "curious";
		return "writing";
	}

	if (step.field === "challenge") return "thinking";
	if (step.field === "goal") return "celebrating";
	return "default";
};

export default function WelcomeScreen() {
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const [activeIndex, setActiveIndex] = useState(0);
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
	const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
	const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
	const [errors, setErrors] = useState<StepErrors>({});
	const { answers, setAnswer } = useOnboarding();
	const { register, isLoading } = useAuth();

	const activeStep = FLOW_STEPS[activeIndex];
	const mascotPose = getMascotPose(activeStep, activeIndex);
	const isIntroStep = activeStep.kind === "intro";
	const isInputStep =
		activeStep.kind === "input" ||
		activeStep.kind === "profileInput" ||
		activeStep.kind === "password";
	const questionnaireIndex = Math.max(activeIndex - INTRO_STEP_COUNT, 0);
	const questionnaireProgress = (questionnaireIndex + 1) / QUESTION_STEP_COUNT;
	const selectedBirthDate = parseBirthDate(answers.birthDate);
	const activeProfileValue =
		activeStep.kind === "profileInput" ? (answers[activeStep.field] ?? "") : "";
	const shouldDisableContinue =
		activeStep.kind === "select"
			? !answers[activeStep.field]
			: activeStep.kind === "input"
				? !answers[activeStep.field].trim()
				: activeStep.kind === "profileInput"
					? activeStep.field === "birthDate"
						? !answers.birthDate.trim()
						: !activeProfileValue.trim()
					: activeStep.kind === "password"
						? !answers.password.trim() || isLoading || isCompletingOnboarding
						: false;

	useEffect(() => {
		if (!isInputStep) return;

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
	}, [isInputStep]);

	const handleContinue = async () => {
		if (isInputStep) Keyboard.dismiss();
		if (activeStep.kind === "profileInput") {
			if (activeStep.field === "name" && !isValidName(answers.name.trim())) {
				setErrors({ name: "Bitte einen gültigen Namen eingeben." });
				return;
			}
			if (
				activeStep.field === "email" &&
				!isValidEmail(answers.email.trim().toLowerCase())
			) {
				setErrors({ email: "Bitte eine gültige E-Mail eingeben." });
				return;
			}
			if (
				activeStep.field === "birthDate" &&
				!isValidBirthDate(selectedBirthDate)
			) {
				setErrors({ birthDate: "Bitte ein gültiges Alter auswählen." });
				return;
			}
		}

		if (activeStep.kind === "password") {
			if (!isValidPassword(answers.password)) {
				setErrors({
					password: "Bitte ein Passwort mit mindestens 8 Zeichen eingeben.",
				});
				return;
			}

			try {
				setIsCompletingOnboarding(true);
				setErrors({});
				const result = await register({
					name: answers.name.trim(),
					email: answers.email.trim().toLowerCase(),
					birthDate: answers.birthDate,
					password: answers.password,
				});
				if (result.status === "complete") {
					router.replace("/home");
					return;
				}
				router.replace("/register");
				return;
			} catch (error) {
				setIsCompletingOnboarding(false);
				setErrors({
					password:
						error instanceof Error
							? error.message
							: "Registrierung fehlgeschlagen. Bitte versuche es erneut.",
				});
				return;
			}
		}

		if (activeIndex < FLOW_STEPS.length - 1) {
			setErrors({});
			setActiveIndex((current) => current + 1);
			return;
		}

		router.replace("/register");
	};

	const handleBack = useCallback(() => {
		if (activeIndex === 0) return false;
		setShowBirthDatePicker(false);
		if (isInputStep) Keyboard.dismiss();
		setActiveIndex((current) => current - 1);
		return true;
	}, [activeIndex, isInputStep]);

	useBackIntent(activeIndex > 0 && !isCompletingOnboarding, handleBack);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />

			<View
				className="flex-1 px-6"
				style={{
					paddingTop: Math.max(insets.top + 12, 18),
					paddingBottom: Math.max(insets.bottom + 18, 24),
				}}
			>
				{isIntroStep ? (
					<>
						<View
							className={`flex-1 items-center ${
								activeIndex === 1 ? "justify-start" : "justify-center"
							}`}
						>
							{activeIndex === 0 ? (
								<View
									className="relative self-stretch overflow-hidden"
									style={{
										height: height < 760 ? 300 : 360,
										marginHorizontal: -22,
									}}
								>
									<Image
										source={require("../../../assets/no-motivation.png")}
										style={{
											width: "100%",
											height: "100%",
										}}
										resizeMode="cover"
									/>

									<LinearGradient
										colors={["rgba(252,252,253,1)", "rgba(252,252,253,0)"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										pointerEvents="none"
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											top: 0,
											height: 116,
										}}
									/>
									<LinearGradient
										colors={["rgba(252,252,253,0)", "rgba(252,252,253,1)"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										pointerEvents="none"
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											bottom: 0,
											height: 138,
										}}
									/>
								</View>
							) : activeIndex === 1 ? (
								<View
									className="relative self-stretch overflow-hidden"
									style={{
										height: height < 760 ? 248 : 304,
										marginTop: 8,
										marginHorizontal: -22,
									}}
								>
									<Image
										source={require("../../../assets/problems.png")}
										style={{
											width: "100%",
											height: "100%",
										}}
										resizeMode="cover"
									/>

									<LinearGradient
										colors={["rgba(252,252,253,1)", "rgba(252,252,253,0)"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										pointerEvents="none"
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											top: 0,
											height: 116,
										}}
									/>
									<LinearGradient
										colors={["rgba(252,252,253,0)", "rgba(252,252,253,1)"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										pointerEvents="none"
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											bottom: 0,
											height: 138,
										}}
									/>
								</View>
							) : (
								<View
									className="relative self-stretch overflow-hidden"
									style={{
										height: height < 760 ? 300 : 360,
										marginHorizontal: -22,
									}}
								>
									<Image
										source={require("../../../assets/motivation.png")}
										style={{
											width: "100%",
											height: "100%",
										}}
										resizeMode="cover"
									/>

									<LinearGradient
										colors={["rgba(252,252,253,1)", "rgba(252,252,253,0)"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										pointerEvents="none"
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											top: 0,
											height: 116,
										}}
									/>
									<LinearGradient
										colors={["rgba(252,252,253,0)", "rgba(252,252,253,1)"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										pointerEvents="none"
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											bottom: 0,
											height: 138,
										}}
									/>
								</View>
							)}
						</View>

						<View className="gap-5 px-7 pt-7 pb-6">
							<View className="flex-row justify-between">
								<View
									className="flex-row"
									style={{ columnGap: 8, paddingTop: 10 }}
								>
									{INTRO_PROGRESS_KEYS.map((key, index) => (
										<View
											key={key}
											className="rounded-full"
											style={{
												width: 8,
												height: 8,
												backgroundColor:
													index === activeIndex ? "#00BAFF" : "#EAF8FF",
											}}
										/>
									))}
								</View>
							</View>

							<View className="gap-5">
								<Text className="font-poppins font-semibold text-heading-2 text-text">
									{activeStep.title}
								</Text>

								<Text className="font-poppins text-body-2 text-secondary-text">
									{activeStep.description}
								</Text>
							</View>

							<PrimaryAction label="Weiter" onPress={handleContinue} />
						</View>
					</>
				) : (
					<KeyboardSafeScrollView
						className="flex-1"
						bottomOffset={112}
						// KeyboardSafeScrollView requires content layout through style.
						contentContainerStyle={keyboardScrollContentStyle}
					>
						<View className="flex-row items-center">
							<BackButton
								onPress={handleBack}
								style={{
									borderWidth: 1,
									borderColor: "rgba(17,24,39,0.06)",
									boxShadow: "0 8px 18px rgba(22, 34, 68, 0.06)",
								}}
								iconSize={18}
								strokeWidth={2.2}
							/>
							<View className="ml-4 flex-1">
								<View
									className="h-1 overflow-hidden rounded-full bg-primary/20"
									style={{ borderCurve: "continuous" }}
								>
									<View
										className="h-full rounded-full bg-primary"
										style={{
											width: `${Math.max(questionnaireProgress * 100, 12)}%`,
										}}
									/>
								</View>
							</View>
						</View>
						<View className="flex-1">
							<View
								className="items-center"
								style={{
									marginTop: isKeyboardVisible ? 10 : 30,
									marginBottom: isKeyboardVisible ? 10 : 18,
								}}
							>
								<Mascot
									key={`question-mascot-${activeIndex}`}
									size={60}
									pose={mascotPose}
								/>
							</View>

							<View className="items-center gap-3">
								<Text className="font-poppins text-body-5 text-secondary-text">
									{activeStep.kind === "info" ? "Gute Nachricht" : "Sag mal"}
								</Text>
								<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
									{activeStep.title}
								</Text>
								{"description" in activeStep && activeStep.description ? (
									<Text className="max-w-72 text-center font-poppins text-body-3 text-secondary-text">
										{activeStep.description}
									</Text>
								) : null}
							</View>

							<View
								className="flex-1 justify-center"
								style={{
									paddingTop: isKeyboardVisible ? 20 : 32,
									paddingBottom: isKeyboardVisible ? 16 : 32,
								}}
							>
								{activeStep.kind === "select" ? (
									<View className="gap-3">
										{activeStep.options.map((option) => {
											const isSelected = answers[activeStep.field] === option;

											return (
												<TouchableOpacity
													key={option}
													accessibilityLabel={option}
													accessibilityRole="radio"
													accessibilityState={{ selected: isSelected }}
													activeOpacity={0.86}
													onPress={() => setAnswer(activeStep.field, option)}
													className="min-h-[60px] justify-center rounded-[22px] px-5"
													style={{
														backgroundColor: isSelected ? "#00BAFF" : "#FFFFFF",
														borderWidth: 1.2,
														borderColor: isSelected
															? "#00BAFF"
															: "rgba(17,24,39,0.08)",
														boxShadow: isSelected
															? "0 12px 26px rgba(0, 186, 255, 0.18)"
															: "0 10px 22px rgba(20, 28, 48, 0.05)",
													}}
												>
													<Text
														className={`font-poppins font-semibold ${
															isSelected ? "text-white" : "text-text"
														}`}
													>
														{option}
													</Text>
												</TouchableOpacity>
											);
										})}
									</View>
								) : null}

								{activeStep.kind === "input" ? (
									<InsetTextField
										label={activeStep.label}
										value={answers[activeStep.field]}
										onChangeText={(value) => {
											setAnswer(activeStep.field, value);
											if (errors.submit) setErrors({});
										}}
										placeholder={activeStep.placeholder}
										autoCapitalize="words"
										autoCorrect={false}
										autoComplete="street-address"
										textContentType="addressState"
										returnKeyType="done"
										controlClassName="bg-card"
										inputClassName="text-body-2"
									/>
								) : null}

								{activeStep.kind === "profileInput" ? (
									activeStep.field === "birthDate" ? (
										<Field>
											<FieldLabel>{activeStep.label}</FieldLabel>
											<FieldTrigger
												activeOpacity={0.82}
												onPress={() => {
													Keyboard.dismiss();
													setShowBirthDatePicker(true);
												}}
												invalid={Boolean(errors.birthDate)}
												className="min-h-[64px] rounded-[28px] bg-card px-5"
											>
												<View className="flex-1">
													<Text
														className={`font-poppins text-body-2 ${
															selectedBirthDate ? "text-text" : "text-text/36"
														}`}
														numberOfLines={1}
													>
														{selectedBirthDate
															? `${getAgeFromBirthDate(selectedBirthDate)} Jahre`
															: "Alter auswählen"}
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
									) : (
										<InsetTextField
											label={activeStep.label}
											value={answers[activeStep.field]}
											onChangeText={(value) => {
												setAnswer(activeStep.field, value);
												if (activeStep.field === "name" && errors.name) {
													setErrors((current) => ({
														...current,
														name: undefined,
													}));
												}
												if (activeStep.field === "email" && errors.email) {
													setErrors((current) => ({
														...current,
														email: undefined,
													}));
												}
											}}
											placeholder={activeStep.placeholder}
											keyboardType={
												activeStep.field === "email"
													? "email-address"
													: "default"
											}
											autoCapitalize={
												activeStep.field === "email" ? "none" : "words"
											}
											autoCorrect={false}
											autoComplete={
												activeStep.field === "email" ? "email" : "name"
											}
											textContentType={
												activeStep.field === "email" ? "emailAddress" : "name"
											}
											invalid={
												activeStep.field === "name"
													? Boolean(errors.name)
													: Boolean(errors.email)
											}
											message={
												activeStep.field === "name" ? errors.name : errors.email
											}
										/>
									)
								) : null}

								{activeStep.kind === "password" ? (
									<InsetTextField
										label="Passwort"
										value={answers.password}
										onChangeText={(value) => {
											setAnswer("password", value);
											if (errors.password) {
												setErrors((current) => ({
													...current,
													password: undefined,
												}));
											}
										}}
										placeholder="Mindestens 8 Zeichen"
										autoCapitalize="none"
										autoCorrect={false}
										autoComplete="new-password"
										textContentType="newPassword"
										secureTextEntry
										invalid={Boolean(errors.password)}
										message={errors.password}
									/>
								) : null}

								{activeStep.kind === "info" ? <View /> : null}
							</View>

							<PrimaryAction
								label={
									activeStep.kind === "password"
										? isLoading || isCompletingOnboarding
											? "Konto wird erstellt..."
											: "Konto erstellen"
										: "Weiter"
								}
								onPress={handleContinue}
								disabled={shouldDisableContinue}
							/>
						</View>
					</KeyboardSafeScrollView>
				)}
			</View>

			{showBirthDatePicker &&
			activeStep.kind === "profileInput" &&
			activeStep.field === "birthDate" ? (
				<DateTimePickerSheet
					visible
					value={selectedBirthDate ?? new Date(2010, 0, 1)}
					mode="date"
					maximumDate={new Date()}
					onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
						if (Platform.OS === "android") setShowBirthDatePicker(false);
						if (event.type === "dismissed" || !selectedDate) return;
						setAnswer("birthDate", formatBirthDate(selectedDate));
						if (errors.birthDate) {
							setErrors((current) => ({ ...current, birthDate: undefined }));
						}
					}}
					onClose={() => setShowBirthDatePicker(false)}
				/>
			) : null}
		</View>
	);
}

function PrimaryAction({
	label,
	onPress,
	disabled,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Button
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			onPress={onPress}
			disabled={disabled}
		>
			<Text>{label}</Text>
		</Button>
	);
}
