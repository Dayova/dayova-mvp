import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ComponentProps, useCallback, useEffect, useState } from "react";
import {
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mascot } from "~/components/Mascot";
import { BackButton, Button } from "~/components/ui/button";
import {
	Field,
	FieldAccessory,
	FieldMessage,
	FieldTrigger,
} from "~/components/ui/field";
import {
	Bell,
	CalendarAdd,
	CheckCircle2,
	ChevronDown,
	ClipboardList,
	ShieldCheck,
	Timer,
	Zap,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { InsetTextField } from "~/components/ui/text-field";
import { useAuth } from "~/context/AuthContext";
import {
	type OnboardingAnswers,
	useOnboarding,
} from "~/context/OnboardingContext";
import { useBackIntent } from "~/lib/navigation";

type MascotPose = ComponentProps<typeof Mascot>["pose"];

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
			"Prokrastination, Ablenkung und Unklarheit halten dich davon ab wirklich voranzukommen",
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
			"Individuell, strukturiert und motiviert - mehr Fortschritt, weniger Stress und echte Erfolge",
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
		title: "Das ist toll! Pro Tag 30min reichen aus um....",
		description:
			"Schon kurze, regelmäßige Lerneinheiten können einen großen Unterschied machen.",
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
		title: "Was sind deine größten Baustellen in der Schule",
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
		title: "Gute Nachricht, eine Studie zeigt, dass...",
		description:
			"kleine Routinen und ein klarer Plan oft wichtiger sind als besonders lange Lernsessions.",
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

const getInsightSolution = (answers: OnboardingAnswers) => {
	if (answers.challenge) {
		if (answers.challenge === "Konzentration") {
			return {
				icon: Timer,
				label: "Konzentration",
				title: "Fokus-Sprints statt Dauerstress",
				description:
					"Dayova teilt deine Aufgaben in kurze Lernblöcke mit klaren Pausen ein.",
				accent: "#3A7BFF",
			};
		}
		if (answers.challenge === "Motivation") {
			return {
				icon: Zap,
				label: "Keine Motivation",
				title: "Tägliche Erinnerungen",
				description:
					"Du bekommst kleine machbare Schritte, die dich jeden Tag wieder reinbringen.",
				accent: "#FFB02E",
			};
		}
		if (answers.challenge === "Organisation") {
			return {
				icon: CalendarAdd,
				label: "Zu wenig Struktur",
				title: "Ein Plan, der dich führt",
				description:
					"Dayova sortiert deine Themen und zeigt dir, was heute wirklich dran ist.",
				accent: "#18A058",
			};
		}
		return {
			icon: ShieldCheck,
			label: "Prüfungsstress",
			title: "Sicher in die Prüfung",
			description:
				"Wir planen Wiederholungen so, dass du früher vorbereitet bist und ruhiger bleibst.",
			accent: "#7C5CFF",
		};
	}

	if (answers.studyTime === "Unter 30 Min.") {
		return {
			icon: Bell,
			label: "Wenig Zeit",
			title: "Mini-Routine mit Reminder",
			description:
				"Schon 15 Minuten am Tag reichen, wenn Dayova dich zur richtigen Aufgabe schickt.",
			accent: "#3A7BFF",
		};
	}

	if (answers.goal) {
		return {
			icon: ClipboardList,
			label: answers.goal,
			title: "Dein Ziel wird zum Plan",
			description:
				"Dayova macht aus deinem Ziel konkrete Schritte, die du einfach abhaken kannst.",
			accent: "#18A058",
		};
	}

	return {
		icon: CheckCircle2,
		label: "Gute Nachricht",
		title: "Kleine Schritte wirken",
		description:
			"Dayova hält dich mit klaren Aufgaben, Feedback und Struktur auf Kurs.",
		accent: "#3A7BFF",
	};
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
	const insightSolution = getInsightSolution(answers);
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
		<KeyboardAvoidingView
			className="flex-1 bg-[#FCFCFD]"
			behavior={isInputStep && Platform.OS === "ios" ? "padding" : undefined}
		>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />

			<View
				className="flex-1 px-[22px]"
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

						<View
							className="rounded-[34px] bg-white px-7 pt-7 pb-6"
							style={{
								borderWidth: 1,
								borderColor: "rgba(17,24,39,0.05)",
								boxShadow: "0 18px 45px rgba(22, 34, 68, 0.08)",
								rowGap: 18,
							}}
						>
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
													index === activeIndex ? "#3A7BFF" : "#DDE7FF",
											}}
										/>
									))}
								</View>
							</View>

							<View style={{ rowGap: 18 }}>
								<Text
									className="font-bold font-poppins text-[#111111]"
									style={{
										fontSize: 25,
										lineHeight: 33,
										includeFontPadding: false,
									}}
								>
									{activeStep.title}
								</Text>

								<Text
									className="font-poppins text-[#7D7F87]"
									style={{
										fontSize: 16,
										lineHeight: 24,
										includeFontPadding: false,
									}}
								>
									{activeStep.description}
								</Text>
							</View>

							<PrimaryAction label="Weiter" onPress={handleContinue} />
						</View>
					</>
				) : (
					<>
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
									className="h-[4px] overflow-hidden rounded-full bg-[#E6EDFF]"
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

							<View className="items-center" style={{ rowGap: 10 }}>
								<Text
									className="font-poppins text-[#A0A4AE]"
									style={{
										fontSize: 11,
										lineHeight: 16,
										includeFontPadding: false,
									}}
								>
									{activeStep.kind === "info" ? "Gute Nachricht" : "Sag mal..."}
								</Text>
								<Text
									className="text-center font-bold font-poppins text-[#111111]"
									style={{
										fontSize: 25,
										lineHeight: 31,
										includeFontPadding: false,
									}}
								>
									{activeStep.title}
								</Text>
								{"description" in activeStep && activeStep.description ? (
									<Text
										className="max-w-[290px] text-center font-poppins text-[#7D7F87]"
										style={{
											fontSize: 15,
											lineHeight: 22,
											includeFontPadding: false,
										}}
									>
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
									<View style={{ rowGap: 12 }}>
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
														backgroundColor: isSelected ? "#3A7BFF" : "#FFFFFF",
														borderWidth: 1.2,
														borderColor: isSelected
															? "#3A7BFF"
															: "rgba(17,24,39,0.08)",
														boxShadow: isSelected
															? "0 12px 26px rgba(58, 123, 255, 0.18)"
															: "0 10px 22px rgba(20, 28, 48, 0.05)",
													}}
												>
													<Text
														className={`font-poppins font-semibold ${
															isSelected ? "text-white" : "text-[#111111]"
														}`}
														style={{
															fontSize: 16,
															lineHeight: 22,
															includeFontPadding: false,
														}}
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
										controlClassName="bg-white"
										inputClassName="text-[18px]"
									/>
								) : null}

								{activeStep.kind === "profileInput" ? (
									activeStep.field === "birthDate" ? (
										<Field>
											<FieldTrigger
												activeOpacity={0.82}
												onPress={() => {
													Keyboard.dismiss();
													setShowBirthDatePicker(true);
												}}
												invalid={Boolean(errors.birthDate)}
												className="min-h-[74px] items-start rounded-[22px] bg-white px-5 pt-3 pb-3"
											>
												<View className="flex-1">
													<Text className="font-poppins text-12 text-text/42 leading-4">
														{activeStep.label}
													</Text>
													<Text
														className={`mt-1 font-poppins text-16 ${
															selectedBirthDate ? "text-text" : "text-text/36"
														}`}
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

								{activeStep.kind === "info" ? (
									<View
										className="rounded-[28px] bg-white px-6 py-7"
										style={{
											borderWidth: 1.2,
											borderColor: "rgba(17,24,39,0.06)",
											boxShadow: "0 14px 32px rgba(20, 28, 48, 0.06)",
											rowGap: 18,
										}}
									>
										<View>
											<Text
												className="text-center font-poppins font-semibold text-[#111111]"
												style={{
													fontSize: 20,
													lineHeight: 28,
													includeFontPadding: false,
												}}
											>
												{activeStep.title}
											</Text>
										</View>

										<SolutionCard solution={insightSolution} />
									</View>
								) : null}
							</View>

							<PrimaryAction
								label={
									activeStep.kind === "password"
										? isLoading || isCompletingOnboarding
											? "Registriert..."
											: "Konto erstellen"
										: "Weiter"
								}
								onPress={handleContinue}
								disabled={shouldDisableContinue}
							/>
						</View>
					</>
				)}
			</View>

			{showBirthDatePicker &&
			activeStep.kind === "profileInput" &&
			activeStep.field === "birthDate" &&
			Platform.OS === "ios" ? (
				<View className="absolute inset-0 z-50 justify-end">
					<TouchableOpacity
						className="absolute inset-0 bg-black/28"
						activeOpacity={1}
						onPress={() => setShowBirthDatePicker(false)}
					/>
					<View className="rounded-t-[32px] bg-white px-4 pt-3 pb-7">
						<View className="mb-1 flex-row justify-end">
							<TouchableOpacity
								onPress={() => setShowBirthDatePicker(false)}
								className="px-3 py-2"
							>
								<Text className="font-bold font-poppins text-16 text-primary">
									Fertig
								</Text>
							</TouchableOpacity>
						</View>
						<View className="items-center">
							<DateTimePicker
								value={selectedBirthDate ?? new Date(2010, 0, 1)}
								mode="date"
								display="spinner"
								maximumDate={new Date()}
								onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
									if (event.type === "dismissed" || !selectedDate) return;
									setAnswer("birthDate", formatBirthDate(selectedDate));
									if (errors.birthDate) {
										setErrors((current) => ({
											...current,
											birthDate: undefined,
										}));
									}
								}}
							/>
						</View>
					</View>
				</View>
			) : null}

			{showBirthDatePicker &&
			activeStep.kind === "profileInput" &&
			activeStep.field === "birthDate" &&
			Platform.OS === "android" ? (
				<DateTimePicker
					value={selectedBirthDate ?? new Date(2010, 0, 1)}
					mode="date"
					display="default"
					maximumDate={new Date()}
					onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
						setShowBirthDatePicker(false);
						if (event.type === "dismissed" || !selectedDate) return;
						setAnswer("birthDate", formatBirthDate(selectedDate));
						if (errors.birthDate) {
							setErrors((current) => ({ ...current, birthDate: undefined }));
						}
					}}
				/>
			) : null}
		</KeyboardAvoidingView>
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

function SolutionCard({
	solution,
}: {
	solution: ReturnType<typeof getInsightSolution>;
}) {
	const Icon = solution.icon;

	return (
		<View
			className="overflow-hidden rounded-[24px] px-4 py-4"
			style={{
				backgroundColor: `${solution.accent}10`,
				borderWidth: 1,
				borderColor: `${solution.accent}22`,
			}}
		>
			<View className="flex-row items-center" style={{ columnGap: 14 }}>
				<View
					className="items-center justify-center rounded-[18px]"
					style={{
						height: 54,
						width: 54,
						backgroundColor: solution.accent,
					}}
				>
					<Icon size={28} color="#FFFFFF" strokeWidth={2.2} />
				</View>

				<View className="flex-1">
					<Text
						className="font-poppins font-semibold"
						style={{
							color: solution.accent,
							fontSize: 12,
							lineHeight: 16,
							includeFontPadding: false,
						}}
					>
						{solution.label}
					</Text>
					<Text
						className="mt-1 font-bold font-poppins text-[#111111]"
						style={{
							fontSize: 16,
							lineHeight: 21,
							includeFontPadding: false,
						}}
					>
						{solution.title}
					</Text>
				</View>
			</View>
		</View>
	);
}
