import { router, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
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
import { BackButton, Button } from "~/components/ui/button";
import { InsetTextField } from "~/components/ui/text-field";
import { Text } from "~/components/ui/text";
import { useOnboarding } from "~/context/OnboardingContext";
import { useBackIntent } from "~/lib/navigation";

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
] as const;

const INTRO_STEP_COUNT = 3;
const QUESTION_STEP_COUNT = FLOW_STEPS.length - INTRO_STEP_COUNT;
const INTRO_PROGRESS_KEYS = [
	"intro-progress-1",
	"intro-progress-2",
	"intro-progress-3",
];

export default function WelcomeScreen() {
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
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

		router.replace("/register");
	};

	const handleBack = useCallback(() => {
		if (activeIndex === 0) return false;
		if (isInputStep) Keyboard.dismiss();
		setActiveIndex((current) => current - 1);
		return true;
	}, [activeIndex, isInputStep]);

	useBackIntent(activeIndex > 0, handleBack);

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
								rowGap: 22,
							}}
						>
							<View className="flex-row" style={{ columnGap: 8 }}>
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
								style={{
									minHeight: isKeyboardVisible ? 28 : height < 760 ? 72 : 96,
								}}
							/>

							<View className="items-center" style={{ rowGap: 10 }}>
								<Text
									className="font-poppins text-[#A0A4AE]"
									style={{
										fontSize: 11,
										lineHeight: 16,
										includeFontPadding: false,
									}}
								>
									Sag mal...
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
