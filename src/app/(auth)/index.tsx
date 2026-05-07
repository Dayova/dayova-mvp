import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	TouchableOpacity,
	View,
	useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InsetTextField } from "~/components/ui/text-field";
import { Text } from "~/components/ui/text";
import { ArrowLeft } from "~/components/ui/icon";
import { useOnboarding } from "~/context/OnboardingContext";

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

type FlowStep = IntroStep | InfoStep | SelectStep | InputStep;

const FLOW_STEPS: readonly FlowStep[] = [
	{
		kind: "intro",
		title: "Herzlich willkommen bei Dayova.",
		description:
			"Mit deinem persönlichen Lernkalender planst du Schule, Lernen und Fortschritte an einem Ort.",
	},
	{
		kind: "intro",
		title: "Kommt dir das bekannt vor?",
		description:
			"Zu viele Aufgaben, kein klarer Überblick und oft die Frage: Was soll ich heute eigentlich lernen?",
	},
	{
		kind: "intro",
		title: "Genau dabei helfen wir dir.",
		description:
			"Jetzt startet eine kurze Informationsumfrage, damit wir deinen Lernkalender passend zu dir erstellen können.",
	},
	{
		kind: "select",
		title: "Wie viel lernst du aktuell pro Tag?",
		field: "studyTime",
		options: ["Unter 30 Min.", "30 bis 60 Min.", "1 bis 2 Stunden", "Mehr als 2 Stunden"],
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
		options: ["Sprachen", "Mathematik", "Naturwissenschaften", "Kreative Fächer"],
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
		options: ["Bessere Noten", "Mehr Struktur", "Weniger Stress", "Konstant dranbleiben"],
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
] as const;

const INTRO_STEP_COUNT = 3;
const QUESTION_STEP_COUNT = FLOW_STEPS.length - INTRO_STEP_COUNT;

export default function WelcomeScreen() {
	const insets = useSafeAreaInsets();
	const { width, height } = useWindowDimensions();
	const [activeIndex, setActiveIndex] = useState(0);
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
	const { answers, setAnswer } = useOnboarding();

	const activeStep = FLOW_STEPS[activeIndex];
	const isIntroStep = activeStep.kind === "intro";
	const isInputStep = activeStep.kind === "input";
	const questionnaireIndex = Math.max(activeIndex - INTRO_STEP_COUNT, 0);
	const questionnaireProgress = (questionnaireIndex + 1) / QUESTION_STEP_COUNT;
	const shouldDisableContinue =
		activeStep.kind === "select"
			? !answers[activeStep.field]
			: activeStep.kind === "input"
				? !answers[activeStep.field].trim()
				: false;

	const heroSize = useMemo(() => {
		if (height < 760) return 122;
		if (width > 420) return 168;
		return 146;
	}, [height, width]);

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

	const handleContinue = () => {
		if (isInputStep) Keyboard.dismiss();
		if (activeIndex < FLOW_STEPS.length - 1) {
			setActiveIndex((current) => current + 1);
			return;
		}

		router.push("/login");
	};

	const handleBack = () => {
		if (activeIndex === 0) return;
		if (isInputStep) Keyboard.dismiss();
		setActiveIndex((current) => current - 1);
	};

	return (
		<KeyboardAvoidingView
			className="flex-1 bg-[#FCFCFD]"
			behavior={isInputStep && Platform.OS === "ios" ? "padding" : undefined}
		>
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
						<View className="flex-1 items-center justify-center">
							<View
								className="items-center justify-center rounded-full"
								style={{
									width: heroSize,
									height: heroSize,
									backgroundColor: "rgba(255,255,255,0.92)",
									boxShadow: "0 20px 55px rgba(50, 90, 180, 0.08)",
								}}
							>
								<Image
									source={require("../../../assets/dayova-logo.png")}
									style={{ width: heroSize * 0.38, height: heroSize * 0.38 }}
									resizeMode="contain"
								/>
							</View>
						</View>

						<View
							className="rounded-[34px] bg-white px-7 pt-7 pb-6"
							style={{
								borderWidth: 1,
								borderColor: "rgba(17,24,39,0.05)",
								boxShadow: "0 18px 45px rgba(22, 34, 68, 0.08)",
								rowGap: 22,
							}}
						>
							<View className="flex-row" style={{ columnGap: 8 }}>
								{Array.from({ length: INTRO_STEP_COUNT }, (_, index) => (
									<View
										key={index}
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

							<View style={{ rowGap: 18 }}>
								<Text
									className="font-poppins font-bold text-[#111111]"
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

							<PrimaryAction
								label="Weiter"
								onPress={handleContinue}
							/>
						</View>
					</>
				) : (
					<>
						<View className="flex-row items-center">
							<TouchableOpacity
								activeOpacity={0.82}
								onPress={handleBack}
								className="h-9 w-9 items-center justify-center rounded-full bg-white"
								style={{
									borderWidth: 1,
									borderColor: "rgba(17,24,39,0.06)",
									boxShadow: "0 8px 18px rgba(22, 34, 68, 0.06)",
								}}
							>
								<ArrowLeft size={18} color="#1A1A1A" strokeWidth={2.2} />
							</TouchableOpacity>

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
								style={{
									minHeight: isKeyboardVisible ? 28 : height < 760 ? 72 : 96,
								}}
							/>

							<View className="items-center" style={{ rowGap: 10 }}>
								<Text
									className="font-poppins text-[#A0A4AE]"
									style={{ fontSize: 11, lineHeight: 16, includeFontPadding: false }}
								>
									Sag mal...
								</Text>
								<Text
									className="text-center font-poppins font-bold text-[#111111]"
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
										onChangeText={(value) => setAnswer(activeStep.field, value)}
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

								{activeStep.kind === "info" ? (
									<View
										className="rounded-[28px] bg-white px-6 py-7"
										style={{
											borderWidth: 1.2,
											borderColor: "rgba(17,24,39,0.06)",
											boxShadow: "0 14px 32px rgba(20, 28, 48, 0.06)",
										}}
									>
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
										{"description" in activeStep && activeStep.description ? (
											<Text
												className="mt-4 text-center font-poppins text-[#7D7F87]"
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
								) : null}
							</View>

							<PrimaryAction
								label="Weiter"
								onPress={handleContinue}
								disabled={shouldDisableContinue}
							/>
						</View>
					</>
				)}
			</View>
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
		<TouchableOpacity
			activeOpacity={disabled ? 1 : 0.9}
			onPress={onPress}
			disabled={disabled}
			className="items-center justify-center rounded-full bg-primary"
			style={{
				minHeight: 56,
				opacity: disabled ? 0.45 : 1,
				boxShadow: "0 10px 24px rgba(58, 123, 255, 0.28)",
			}}
		>
			<Text
				className="font-poppins font-bold text-white"
				style={{ fontSize: 22, lineHeight: 30, includeFontPadding: false }}
			>
				{label}
			</Text>
		</TouchableOpacity>
	);
}
