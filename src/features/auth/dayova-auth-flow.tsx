import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router, Stack } from "expo-router";
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	TextInput,
	type TextInputProps,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	FadeIn,
	FadeInDown,
	FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	getNextOnboardingStepIndex,
	getOnboardingRegistrationPayload,
	getOnboardingStepDecision,
} from "~/components/onboarding/onboarding-flow";
import {
	OnboardingSelect,
	PickerInputTrigger,
} from "~/components/onboarding/onboarding-select";
import { AnimatedFlowerLoader } from "~/components/ui/animated-flower-loader";
import type { DateTimePickerEvent } from "~/components/ui/date-time-picker-sheet";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import {
	ArrowLeft,
	Atom,
	Bulb,
	Check,
	ClipboardList,
	Globe,
	GreekHelmet,
	Palette,
	Plant,
	Route2,
	SquareRootSquare,
	Telescope,
} from "~/components/ui/icon";
import { KeyboardSafeScrollView } from "~/components/ui/keyboard-safe-scroll-view";
import { PasswordVisibilityButton } from "~/components/ui/password-visibility-button";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthFlow, useAuthSession } from "~/context/AuthContext";
import { useOnboarding } from "~/context/OnboardingContext";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { PASSWORD_RESET_SUCCESS_PATH } from "~/lib/auth-routing";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { GERMAN_FEDERAL_STATES } from "~/lib/federal-states";
import { GRADE_OPTIONS } from "~/lib/grades";
import { useBackIntent } from "~/lib/navigation";
import { meetsPasswordRequirements } from "~/lib/password-validation";
import {
	type RegistrationStage,
	shouldHandleRegistrationBack,
} from "~/lib/registration-navigation";
import { SCHOOL_TYPE_OPTIONS, SCHOOL_TYPE_VALUES } from "~/lib/school-types";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

// Password icons represent the current visibility state across this auth flow.
// Decision: https://app.notion.com/p/39f2e87228bf81c28511c0728134c774
const COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const PRIMARY_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const QUESTION_TITLE_STYLE = DAYOVA_DESIGN_SYSTEM.typography.headline.h2;
const CODE_LENGTH = 6;
const OTP_CELL_KEYS = [
	"otp-cell-1",
	"otp-cell-2",
	"otp-cell-3",
	"otp-cell-4",
	"otp-cell-5",
	"otp-cell-6",
] as const;
const otpAutoComplete = Platform.select<TextInputProps["autoComplete"]>({
	android: "sms-otp",
	default: "one-time-code",
});

type PasswordResetStage =
	| "email"
	| "reset_code"
	| "new_password"
	| "second_factor";

type IntroStep = {
	kind: "intro";
	id: "intro-value";
	title: string;
};

type TextStep = {
	kind: "text";
	id: "name" | "email" | "password";
	title: string;
	description: string;
	field: "name" | "email" | "password";
	placeholder: string;
	secure?: boolean;
	keyboardType?: TextInputProps["keyboardType"];
	autoComplete?: TextInputProps["autoComplete"];
	textContentType?: TextInputProps["textContentType"];
};

type WheelStep = {
	kind: "wheel";
	id: "state" | "schoolType" | "grade" | "birthDate";
	title: string;
	description: string;
	field: "state" | "schoolType" | "grade" | "birthDate";
};

type OnboardingStep = IntroStep | TextStep | WheelStep;

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_BIRTH_DAY = "09";
const DEFAULT_BIRTH_MONTH = "09";
const DEFAULT_BIRTH_YEAR = String(CURRENT_YEAR - 14);

const DEFAULT_BIRTH_DATE = `${DEFAULT_BIRTH_DAY}.${DEFAULT_BIRTH_MONTH}.${DEFAULT_BIRTH_YEAR}`;

function formatPickerDate(date: Date) {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${day}.${month}.${date.getFullYear()}`;
}

function parsePickerDate(value: string) {
	const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
	if (!match) return new Date(Number(DEFAULT_BIRTH_YEAR), 8, 9);

	const [, day, month, year] = match;
	const parsed = new Date(Number(year), Number(month) - 1, Number(day));
	return Number.isNaN(parsed.getTime())
		? new Date(Number(DEFAULT_BIRTH_YEAR), 8, 9)
		: parsed;
}

const INTRO_STEPS = [
	{
		kind: "intro",
		id: "intro-value",
		title: "Deine Prüfung. Dein nächster Schritt.",
	},
] as const satisfies readonly IntroStep[];
const FLOW_STEPS: readonly OnboardingStep[] = [
	...INTRO_STEPS,
	{
		kind: "text",
		id: "name",
		title: "Wie dürfen wir dich nennen?",
		description: "Damit sich Dayova von Anfang an persönlich anfühlt.",
		field: "name",
		placeholder: "Dein Name",
		autoComplete: "name",
		textContentType: "name",
	},
	{
		kind: "wheel",
		id: "grade",
		title: "Welche Klassenstufe besuchst du?",
		description: "So passen Sprache und Aufgaben besser zu deinem Schulalltag.",
		field: "grade",
	},
	{
		kind: "wheel",
		id: "state",
		title: "In welchem Bundesland gehst du zur Schule?",
		description:
			"Schulbegriffe und Rahmenbedingungen unterscheiden sich regional.",
		field: "state",
	},
	{
		kind: "wheel",
		id: "schoolType",
		title: "Welche Schulart besuchst du?",
		description:
			"Wir speichern nur die Schulart, nicht den Namen deiner Schule.",
		field: "schoolType",
	},
	{
		kind: "wheel",
		id: "birthDate",
		title: "Wann bist du geboren?",
		description:
			"Dein Geburtsdatum hilft uns, dein Konto altersgerecht zu führen.",
		field: "birthDate",
	},
	{
		kind: "text",
		id: "email",
		title: "Wie lautet deine E-Mail-Adresse?",
		description:
			"Dorthin senden wir gleich deinen sechsstelligen Bestätigungscode.",
		field: "email",
		placeholder: "name@beispiel.de",
		keyboardType: "email-address",
		autoComplete: "email",
		textContentType: "emailAddress",
	},
	{
		kind: "text",
		id: "password",
		title: "Lege dein Passwort fest.",
		description: "Mindestens 8 Zeichen schützen dein Konto.",
		field: "password",
		placeholder: "Passwort eingeben",
		secure: true,
		autoComplete: "new-password",
		textContentType: "newPassword",
	},
] as const;

const PROFILE_STEP_COUNT = FLOW_STEPS.length - INTRO_STEPS.length;

const isValidEmail = (value: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const AUTH_CHOICE_FRAME = {
	width: 393,
	height: 852,
	patternYOffset: 32,
	logoCard: { top: 232, size: 148, radius: 32, iconSize: 136 },
	title: { top: 392, fontSize: 64, lineHeight: 68 },
	subtitle: { top: 477, width: 260, fontSize: 16, lineHeight: 23 },
	buttons: { top: 592, width: 326, height: 54, gap: 12 },
	terms: { top: 732, width: 250, fontSize: 10, lineHeight: 15 },
} as const;
const AUTH_BACKGROUND_TILE = {
	size: 148,
	radius: 32,
	iconSize: 76,
	leftX: -62,
	centerX: 122.5,
	rightX: 307,
	fillColors: [
		"rgba(26,26,26,0)",
		"rgba(26,26,26,0.06)",
		"rgba(26,26,26,0.06)",
		"rgba(26,26,26,0)",
	],
} as const;

export function AuthChoiceScreen() {
	const { colors: COLORS } = useDayovaTheme();
	const { width, height } = useWindowDimensions();
	const frameScale = Math.min(
		width / AUTH_CHOICE_FRAME.width,
		height / AUTH_CHOICE_FRAME.height,
	);
	const frameWidth = AUTH_CHOICE_FRAME.width * frameScale;
	const frameHeight = AUTH_CHOICE_FRAME.height * frameScale;
	const scaled = (value: number) => value * frameScale;
	const buttonLeft = scaled(
		(AUTH_CHOICE_FRAME.width - AUTH_CHOICE_FRAME.buttons.width) / 2,
	);
	const verticalPadding = Math.max(0, (height - frameHeight) / 2);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ title: "Dayova" }} />
			<ThemedStatusBar />
			<ScrollView
				contentInsetAdjustmentBehavior="never"
				showsVerticalScrollIndicator={false}
				bounces={false}
				contentContainerStyle={{
					minHeight: height,
					paddingTop: verticalPadding,
					paddingBottom: verticalPadding,
					alignItems: "center",
				}}
			>
				<View
					style={{
						width: frameWidth,
						height: frameHeight,
					}}
				>
					<Animated.View
						entering={FadeIn.duration(450)}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: frameWidth,
							height: frameHeight,
							overflow: "hidden",
						}}
					>
						<AuthBackgroundPattern
							scale={frameScale}
							yOffset={AUTH_CHOICE_FRAME.patternYOffset}
						/>
					</Animated.View>

					<Animated.View
						entering={FadeInDown.duration(520).springify().damping(18)}
						style={{
							position: "absolute",
							top: scaled(AUTH_CHOICE_FRAME.logoCard.top),
							left: 0,
							width: frameWidth,
							alignItems: "center",
						}}
					>
						<View
							style={{
								width: scaled(AUTH_CHOICE_FRAME.logoCard.size),
								height: scaled(AUTH_CHOICE_FRAME.logoCard.size),
								borderRadius: scaled(AUTH_CHOICE_FRAME.logoCard.radius),
								backgroundColor: COLORS.surface,
								alignItems: "center",
								justifyContent: "center",
								boxShadow: `0 ${scaled(18)}px ${scaled(45)}px rgba(20, 28, 48, 0.06)`,
							}}
						>
							<Image
								source={require("../../../assets/onboarding/dayova-y.png")}
								resizeMode="contain"
								style={{
									width: scaled(AUTH_CHOICE_FRAME.logoCard.iconSize),
									height: scaled(AUTH_CHOICE_FRAME.logoCard.iconSize),
								}}
							/>
						</View>
					</Animated.View>

					<Animated.View
						entering={FadeInDown.delay(40)
							.duration(520)
							.springify()
							.damping(18)}
						style={{
							position: "absolute",
							top: scaled(AUTH_CHOICE_FRAME.title.top),
							left: 0,
							width: frameWidth,
							alignItems: "center",
						}}
					>
						<Text
							className="text-center font-poppins font-semibold text-text"
							style={{
								fontSize: scaled(AUTH_CHOICE_FRAME.title.fontSize),
								lineHeight: scaled(AUTH_CHOICE_FRAME.title.lineHeight),
								includeFontPadding: false,
							}}
						>
							Dayova
						</Text>
					</Animated.View>

					<Animated.View
						entering={FadeInDown.delay(80)
							.duration(520)
							.springify()
							.damping(18)}
						style={{
							position: "absolute",
							top: scaled(AUTH_CHOICE_FRAME.subtitle.top),
							left: (frameWidth - scaled(AUTH_CHOICE_FRAME.subtitle.width)) / 2,
							width: scaled(AUTH_CHOICE_FRAME.subtitle.width),
						}}
					>
						<Text
							className="text-center font-poppins text-secondary-text"
							style={{
								fontSize: scaled(AUTH_CHOICE_FRAME.subtitle.fontSize),
								lineHeight: scaled(AUTH_CHOICE_FRAME.subtitle.lineHeight),
								includeFontPadding: false,
							}}
						>
							Du bist neu hier, dann registriere dich. Andernfalls willkommen
							zurück
						</Text>
					</Animated.View>

					<Animated.View
						entering={FadeInUp.delay(120).duration(520).springify().damping(18)}
						style={{
							position: "absolute",
							top: scaled(AUTH_CHOICE_FRAME.buttons.top),
							left: buttonLeft,
							width: scaled(AUTH_CHOICE_FRAME.buttons.width),
							gap: scaled(AUTH_CHOICE_FRAME.buttons.gap),
						}}
					>
						<AuthChoicePillButton
							label="Registrierung"
							scale={frameScale}
							tone="gradient"
							onPress={() => router.push("/onboarding")}
						/>
						<AuthChoicePillButton
							label="Login"
							scale={frameScale}
							tone="dark"
							onPress={() => router.push("/login")}
						/>
					</Animated.View>

					<Text
						className="absolute text-center font-poppins text-black-30"
						style={{
							top: scaled(AUTH_CHOICE_FRAME.terms.top),
							left: (frameWidth - scaled(AUTH_CHOICE_FRAME.terms.width)) / 2,
							width: scaled(AUTH_CHOICE_FRAME.terms.width),
							fontSize: scaled(AUTH_CHOICE_FRAME.terms.fontSize),
							lineHeight: scaled(AUTH_CHOICE_FRAME.terms.lineHeight),
							includeFontPadding: false,
						}}
					>
						Mit dem Start akzeptierst du{"\n"}Datenschutzbestimmungen und
						{"\n"}Nutzungsbedingungen.
					</Text>
				</View>
			</ScrollView>
		</View>
	);
}

export function RegisterRedirectScreen() {
	return <Redirect href="/onboarding" />;
}

export function OnboardingScreen({
	initialStepId,
}: {
	initialStepId?: OnboardingStep["id"];
} = {}) {
	const insets = useSafeAreaInsets();
	const [activeIndex, setActiveIndex] = useState(() => {
		if (!initialStepId) return 0;
		const initialIndex = FLOW_STEPS.findIndex(
			(step) => step.id === initialStepId,
		);
		return Math.max(initialIndex, 0);
	});
	const [stage, setStage] = useState<RegistrationStage>("flow");
	const [error, setError] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState("");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [isRegistering, setIsRegistering] = useState(false);
	const { register, verifyEmailCode, resendVerification, isLoading } =
		useAuthFlow();
	const { user, isConvexAuthenticated, isPostAuthSyncing } = useAuthSession();
	const { answers, hasAnswers } = useOnboarding();
	const activeStep = FLOW_STEPS[activeIndex];
	const textInputRef = useRef<TextInput | null>(null);
	const verificationInputRef = useRef<TextInput | null>(null);
	const verificationSubmittedRef = useRef(false);
	const isCreationComplete = Boolean(
		stage === "creating" &&
			user &&
			isConvexAuthenticated &&
			!hasAnswers &&
			!isPostAuthSyncing,
	);
	const registrationActionGateRef = useRef(createAsyncActionGate());
	const isRegistrationBusy = isLoading || isRegistering;

	useEffect(() => {
		if (stage !== "verification") return;
		const frame = requestAnimationFrame(() =>
			verificationInputRef.current?.focus(),
		);
		return () => cancelAnimationFrame(frame);
	}, [stage]);

	useEffect(() => {
		if (stage !== "flow" || !user || hasAnswers || isPostAuthSyncing) return;

		const frame = requestAnimationFrame(() => {
			router.replace("/trial");
		});

		return () => cancelAnimationFrame(frame);
	}, [hasAnswers, isPostAuthSyncing, stage, user]);

	const handleBack = useCallback(() => {
		if (
			stage === "creating" ||
			isRegistrationBusy ||
			registrationActionGateRef.current.isRunning
		) {
			return true;
		}
		if (stage === "verification") {
			setStage("flow");
			setVerificationCode("");
			setError(null);
			verificationSubmittedRef.current = false;
			return true;
		}
		if (activeIndex === 0) {
			if (router.canGoBack()) {
				router.back();
			} else {
				router.replace("/");
			}
			return true;
		}
		Keyboard.dismiss();
		setError(null);
		setActiveIndex((current) => current - 1);
		return true;
	}, [activeIndex, isRegistrationBusy, stage]);

	const shouldHandleInternalBack = shouldHandleRegistrationBack(
		activeIndex,
		stage,
	);
	useBackIntent(shouldHandleInternalBack, handleBack);

	const stepProgress =
		stage === "verification" || stage === "creating"
			? 1
			: Math.min(activeIndex / PROFILE_STEP_COUNT, 1);

	const continueFromStep = async () => {
		if (
			stage !== "flow" ||
			isRegistrationBusy ||
			registrationActionGateRef.current.isRunning
		) {
			return;
		}
		setError(null);
		const decision = getOnboardingStepDecision(activeStep, answers);

		if (activeStep.kind === "text") {
			Keyboard.dismiss();
		}

		if (decision.error) {
			setError(decision.error);
			return;
		}

		if (decision.action === "register") {
			await startRegistration();
			return;
		}

		setActiveIndex((current) =>
			getNextOnboardingStepIndex(current, FLOW_STEPS.length),
		);
	};

	const startRegistration = async () => {
		await registrationActionGateRef.current.run(async () => {
			setIsRegistering(true);
			try {
				const result = await register(
					getOnboardingRegistrationPayload(answers),
				);

				if (result.status === "complete") {
					setStage("creating");
					return;
				}

				setStage("verification");
				setVerificationCode("");
				verificationSubmittedRef.current = false;
			} catch (registrationError) {
				setError(
					registrationError instanceof Error
						? registrationError.message
						: "Registrierung fehlgeschlagen. Bitte versuche es erneut.",
				);
			} finally {
				setIsRegistering(false);
			}
		});
	};

	const submitVerificationCode = async (code: string) => {
		if (verificationSubmittedRef.current) return;
		verificationSubmittedRef.current = true;
		Keyboard.dismiss();
		setStage("creating");
		setError(null);
		try {
			await verifyEmailCode(code);
		} catch (verificationError) {
			verificationSubmittedRef.current = false;
			setStage("verification");
			setVerificationCode("");
			setError(
				verificationError instanceof Error
					? verificationError.message
					: "Der Code konnte nicht bestätigt werden.",
			);
			requestAnimationFrame(() => verificationInputRef.current?.focus());
		}
	};

	const handleVerificationChange = (value: string) => {
		const sanitized = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
		setVerificationCode(sanitized);
		if (sanitized.length === CODE_LENGTH) {
			void submitVerificationCode(sanitized);
		}
	};

	if (stage === "creating") {
		return (
			<CreationLoaderScreen
				topInset={insets.top}
				bottomInset={insets.bottom}
				isComplete={isCreationComplete}
			/>
		);
	}

	if (stage === "verification") {
		return (
			<VerificationScreen
				email={answers.email.trim().toLowerCase()}
				code={verificationCode}
				error={error}
				disabled={isLoading}
				inputRef={verificationInputRef}
				progress={stepProgress}
				topInset={insets.top}
				bottomInset={insets.bottom}
				onBack={handleBack}
				onChangeCode={handleVerificationChange}
				onResend={async () => {
					try {
						setError(null);
						await resendVerification();
					} catch (resendError) {
						setError(
							resendError instanceof Error
								? resendError.message
								: "Code konnte nicht erneut gesendet werden.",
						);
					}
				}}
			/>
		);
	}

	const isIntro = activeStep.kind === "intro";

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ title: "Registrierung", gestureEnabled: false }}
			/>
			<ThemedStatusBar />
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1"
			>
				{isIntro ? (
					<IntroStepView
						topInset={insets.top}
						bottomInset={insets.bottom}
						onNext={continueFromStep}
					/>
				) : (
					<View
						key={activeStep.id}
						style={{
							flex: 1,
							paddingTop: Math.max(insets.top + 12, 20),
							paddingHorizontal: 24,
						}}
					>
						<QuestionStepView
							step={activeStep}
							progress={stepProgress}
							stepNumber={activeIndex}
							stepCount={PROFILE_STEP_COUNT}
							error={error}
							busy={isRegistrationBusy}
							passwordVisible={passwordVisible}
							inputRef={textInputRef}
							bottomInset={insets.bottom}
							onBack={handleBack}
							onContinue={continueFromStep}
							onTogglePassword={() => setPasswordVisible((current) => !current)}
						/>
					</View>
				)}
			</KeyboardAvoidingView>
		</View>
	);
}

function IntroStepView({
	topInset,
	bottomInset,
	onNext,
}: {
	topInset: number;
	bottomInset: number;
	onNext: () => void;
}) {
	const { height } = useWindowDimensions();
	const isCompactHeight = height < 760;
	const valuePoints = [
		{
			icon: ClipboardList,
			title: "Deine genaue Prüfung",
			body: "Materialien und Prüfungsziel geben den Rahmen vor.",
		},
		{
			icon: Bulb,
			title: "Deine echten Lücken",
			body: "Kurze Fragen zeigen, was schon sitzt und was noch fehlt.",
		},
		{
			icon: Route2,
			title: "Dein nächster Schritt",
			body: "Du siehst genau, womit du heute sinnvoll startest.",
		},
	] as const;

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="never"
			alwaysBounceVertical={false}
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{
				minHeight: height,
				paddingTop: Math.max(topInset + (isCompactHeight ? 20 : 32), 32),
				paddingBottom: Math.max(bottomInset + 24, 36),
				paddingHorizontal: 24,
			}}
		>
			<Animated.View entering={FadeIn.duration(240)} className="flex-1">
				<View className="items-center">
					<View className="flex-row items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
						<Route2 size={16} color={COLORS.primary} strokeWidth={2.2} />
						<Text className="font-poppins font-semibold text-body-5 text-primary">
							DEIN START MIT DAYOVA
						</Text>
					</View>

					<Text
						accessibilityRole="header"
						className={cn(
							"max-w-[345px] text-center font-poppins font-semibold text-text",
							isCompactHeight ? "mt-5 text-heading-2" : "mt-7 text-heading-1",
						)}
					>
						{INTRO_STEPS[0]?.title}
					</Text>
					<Text className="mt-3 max-w-[330px] text-center font-poppins text-body-3 text-secondary-text">
						Dayova verbindet deine Unterlagen, deinen Lernstand und deine
						verfügbare Zeit zu einem klaren Weg bis zur Prüfung.
					</Text>
				</View>

				<View
					className={cn(
						"w-full rounded-[32px] border border-border bg-surface px-5",
						isCompactHeight ? "mt-6 py-3" : "mt-8 py-5",
					)}
					style={{ boxShadow: "0 16px 36px rgba(20, 28, 48, 0.06)" }}
				>
					{valuePoints.map((point, index) => {
						const Icon = point.icon;
						return (
							<View
								key={point.title}
								className={cn(
									"flex-row gap-4",
									index < valuePoints.length - 1 && "border-border border-b",
									isCompactHeight ? "py-3" : "py-4",
								)}
							>
								<View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
									<Icon size={20} color={COLORS.primary} strokeWidth={2.2} />
								</View>
								<View className="flex-1">
									<Text className="font-poppins font-semibold text-body-3 text-text">
										{point.title}
									</Text>
									<Text className="mt-0.5 font-poppins text-body-4 text-secondary-text">
										{point.body}
									</Text>
								</View>
							</View>
						);
					})}
				</View>

				<View className={cn("mt-auto", isCompactHeight ? "pt-6" : "pt-8")}>
					<GradientPillButton label="Profil einrichten" onPress={onNext} />
					<Text className="mt-3 text-center font-poppins text-body-5 text-secondary-text">
						7 kurze Schritte · dauert etwa 1 Minute
					</Text>
				</View>
			</Animated.View>
		</ScrollView>
	);
}

function QuestionStepView({
	step,
	progress,
	stepNumber,
	stepCount,
	error,
	busy,
	passwordVisible,
	inputRef,
	bottomInset,
	onBack,
	onContinue,
	onTogglePassword,
}: {
	step: Exclude<OnboardingStep, IntroStep>;
	progress: number;
	stepNumber: number;
	stepCount: number;
	error: string | null;
	busy: boolean;
	passwordVisible: boolean;
	inputRef: RefObject<TextInput | null>;
	bottomInset: number;
	onBack: () => boolean;
	onContinue: () => void;
	onTogglePassword: () => void;
}) {
	const { colors: COLORS } = useDayovaTheme();
	const { answers, setAnswer } = useOnboarding();
	const isWheelStep = step.kind === "wheel";
	const titleTopPadding = step.kind === "text" ? 50 : 36;
	const continueLabel =
		step.kind === "text" && step.field === "password"
			? busy
				? "Konto wird erstellt"
				: "Konto erstellen"
			: busy
				? "Wird verarbeitet"
				: "Weiter";

	return (
		<View className="flex-1">
			<AuthProgressHeader
				progress={progress}
				progressLabel={`${stepNumber} von ${stepCount}`}
				onBack={onBack}
				disabled={busy}
			/>

			<ScrollView
				className="flex-1"
				keyboardShouldPersistTaps="handled"
				contentInsetAdjustmentBehavior="never"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					flexGrow: 1,
					paddingBottom: Math.max(bottomInset + 112, 122),
				}}
			>
				<Animated.View
					entering={FadeInDown.duration(220)}
					style={{
						flex: 1,
						alignItems: "center",
						paddingTop: titleTopPadding,
					}}
				>
					<Text
						accessibilityRole="header"
						className="text-center font-poppins"
						style={{
							color: COLORS.text,
							fontSize: QUESTION_TITLE_STYLE.fontSize,
							lineHeight: QUESTION_TITLE_STYLE.lineHeight,
							fontWeight: QUESTION_TITLE_STYLE.fontWeight,
						}}
					>
						{step.title}
					</Text>
					<Text className="mt-3 max-w-[330px] text-center font-poppins text-body-4 text-secondary-text">
						{step.description}
					</Text>

					<View
						style={{
							width: "100%",
							marginTop: isWheelStep ? 20 : 22,
							flex: isWheelStep ? 1 : undefined,
							alignItems: "center",
							justifyContent: isWheelStep ? "center" : undefined,
						}}
					>
						{step.kind === "wheel" ? <WheelAnswer step={step} /> : null}

						{step.kind === "text" ? (
							<>
								<PillTextInput
									refObject={inputRef}
									value={answers[step.field]}
									accessibilityLabel={step.title.replace(/\n/g, " ")}
									placeholder={step.placeholder}
									secure={step.secure && !passwordVisible}
									disabled={busy}
									keyboardType={step.keyboardType}
									autoComplete={step.autoComplete}
									textContentType={step.textContentType}
									autoCapitalize={
										step.field === "email" || step.secure ? "none" : "words"
									}
									onChangeText={(value) => setAnswer(step.field, value)}
									onSubmit={onContinue}
									accessory={
										step.secure ? (
											<PasswordVisibilityButton
												fieldLabel="Passwort"
												visible={passwordVisible}
												disabled={busy}
												onToggle={onTogglePassword}
											/>
										) : null
									}
								/>
								{step.field === "password" ? (
									<View className="mt-4 w-full max-w-[345px] flex-row items-center gap-3 px-1">
										<View
											className={cn(
												"h-6 w-6 items-center justify-center rounded-full",
												meetsPasswordRequirements(answers.password)
													? "bg-success"
													: "border border-border bg-surface",
											)}
										>
											{meetsPasswordRequirements(answers.password) ? (
												<Check
													size={14}
													color={COLORS.surface}
													strokeWidth={2.4}
												/>
											) : null}
										</View>
										<Text
											className={cn(
												"font-poppins text-body-4",
												meetsPasswordRequirements(answers.password)
													? "text-success"
													: "text-secondary-text",
											)}
										>
											Mindestens 8 Zeichen
										</Text>
									</View>
								) : null}
							</>
						) : null}
					</View>

					{error ? (
						<Animated.Text
							accessibilityLiveRegion="polite"
							accessibilityRole="alert"
							selectable
							entering={FadeIn.duration(180)}
							style={{
								marginTop: 12,
								fontFamily: "Poppins",
								fontSize: 12,
								lineHeight: 18,
								color: COLORS.destructive,
								textAlign: "center",
							}}
						>
							{error}
						</Animated.Text>
					) : null}
				</Animated.View>
			</ScrollView>

			<View
				style={{
					paddingTop: 8,
					paddingBottom: Math.max(bottomInset + 52, 60),
				}}
			>
				<DarkPillButton
					label={continueLabel}
					onPress={onContinue}
					disabled={busy}
					busy={busy}
				/>
			</View>
		</View>
	);
}

export function LoginScreen() {
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const isCompactHeight = height < 850;
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState("");
	const [verificationMode, setVerificationMode] = useState(false);
	const [passwordResetMode, setPasswordResetMode] = useState(false);
	const verificationInputRef = useRef<TextInput | null>(null);
	const submittedRef = useRef(false);
	const loginActionGateRef = useRef(createAsyncActionGate());
	const {
		login,
		verifyEmailCode,
		resendVerification,
		isLoading,
		pendingVerification,
	} = useAuthFlow();

	useEffect(() => {
		if (!verificationMode) return;
		const frame = requestAnimationFrame(() =>
			verificationInputRef.current?.focus(),
		);
		return () => cancelAnimationFrame(frame);
	}, [verificationMode]);

	const submitLogin = async () => {
		Keyboard.dismiss();
		setError(null);
		if (!isValidEmail(email.trim().toLowerCase())) {
			setError("Bitte gib eine gültige E-Mail-Adresse ein.");
			return;
		}
		if (!password.trim()) {
			setError("Bitte gib dein Passwort ein.");
			return;
		}
		await loginActionGateRef.current.run(async () => {
			setIsSubmittingLogin(true);
			try {
				const result = await login({
					email: email.trim().toLowerCase(),
					password,
				});
				if (result.status === "complete") {
					// Session-boundary navigation is owned by the root auth guard.
					return;
				}
				setVerificationMode(true);
				setVerificationCode("");
				submittedRef.current = false;
			} catch (loginError) {
				setError(
					loginError instanceof Error
						? loginError.message
						: "Anmeldung fehlgeschlagen.",
				);
			} finally {
				setIsSubmittingLogin(false);
			}
		});
	};

	const submitLoginCode = async (code: string) => {
		if (submittedRef.current) return;
		submittedRef.current = true;
		Keyboard.dismiss();
		setError(null);
		try {
			const result = await verifyEmailCode(code);
			if (result.status === "complete") return;
		} catch (verificationError) {
			submittedRef.current = false;
			setVerificationCode("");
			setError(
				verificationError instanceof Error
					? verificationError.message
					: "Der Code konnte nicht bestätigt werden.",
			);
			requestAnimationFrame(() => verificationInputRef.current?.focus());
		}
	};

	if (verificationMode) {
		return (
			<VerificationScreen
				email={pendingVerification?.email ?? email.trim().toLowerCase()}
				code={verificationCode}
				error={error}
				disabled={isLoading}
				inputRef={verificationInputRef}
				progress={0.96}
				topInset={insets.top}
				bottomInset={insets.bottom}
				onBack={() => {
					setVerificationMode(false);
					setVerificationCode("");
					submittedRef.current = false;
					return true;
				}}
				onChangeCode={(value) => {
					const sanitized = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
					setVerificationCode(sanitized);
					if (sanitized.length === CODE_LENGTH) {
						void submitLoginCode(sanitized);
					}
				}}
				onResend={async () => {
					try {
						setError(null);
						await resendVerification();
					} catch (resendError) {
						setError(
							resendError instanceof Error
								? resendError.message
								: "Code konnte nicht erneut gesendet werden.",
						);
					}
				}}
			/>
		);
	}

	if (passwordResetMode) {
		return (
			<PasswordResetScreen
				initialEmail={email}
				onCancel={() => setPasswordResetMode(false)}
			/>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ title: "Login" }} />
			<ThemedStatusBar />
			<View className="flex-1">
				<KeyboardSafeScrollView
					className="flex-1"
					contentInsetAdjustmentBehavior="never"
					alwaysBounceVertical={false}
					contentContainerStyle={{
						flexGrow: 1,
						paddingTop: Math.max(
							insets.top + (isCompactHeight ? 52 : 64),
							isCompactHeight ? 68 : 76,
						),
						paddingBottom: Math.max(
							insets.bottom + (isCompactHeight ? 12 : 18),
							isCompactHeight ? 24 : 28,
						),
					}}
				>
					<View className="flex-1 items-center px-8">
						<Animated.View
							entering={FadeInDown.duration(440).springify().damping(18)}
						>
							<Image
								source={require("../../../assets/dayova-logo.png")}
								resizeMode="contain"
								className="h-36 w-36"
							/>
						</Animated.View>

						<Text
							accessibilityRole="header"
							className={cn(
								"text-center font-poppins font-semibold text-heading-1 text-text",
								isCompactHeight ? "mt-8" : "mt-10",
							)}
						>
							Willkommen
						</Text>
						<Text className="mt-1 max-w-[300px] text-center font-poppins text-body-3 text-text">
							Freut uns dich wiederzusehen, melde dich{"\n"}an und starte
							direkt.
						</Text>

						<View className="mt-7 w-full gap-4">
							<FormPill
								accessibilityLabel="E-Mail-Adresse"
								value={email}
								placeholder="max.mustermann@gmail.com"
								keyboardType="email-address"
								autoCapitalize="none"
								autoComplete="email"
								textContentType="emailAddress"
								onChangeText={setEmail}
								onSubmitEditing={() => Keyboard.dismiss()}
							/>
							<FormPill
								accessibilityLabel="Passwort"
								value={password}
								placeholder="••••••••"
								secureTextEntry={!passwordVisible}
								autoCapitalize="none"
								autoComplete="current-password"
								textContentType="password"
								onChangeText={setPassword}
								onSubmitEditing={submitLogin}
								rightAccessory={
									<PasswordVisibilityButton
										fieldLabel="Passwort"
										visible={passwordVisible}
										onToggle={() => setPasswordVisible((current) => !current)}
									/>
								}
							/>
						</View>

						<View className="w-full flex-row justify-end">
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Passwort vergessen"
								accessibilityHint="Öffnet den Ablauf zum Zurücksetzen deines Passworts"
								disabled={isLoading || isSubmittingLogin}
								accessibilityState={{
									disabled: isLoading || isSubmittingLogin,
								}}
								className="min-h-11 max-w-full justify-center"
								onPress={() => {
									if (isLoading || isSubmittingLogin) return;
									setError(null);
									setPasswordResetMode(true);
								}}
							>
								<Text className="text-right font-poppins text-body-4 text-primary">
									Passwort vergessen?
								</Text>
							</Pressable>
						</View>

						{error ? (
							<Animated.Text
								accessibilityLiveRegion="polite"
								accessibilityRole="alert"
								selectable
								entering={FadeIn.duration(180)}
								className="mt-3 text-center font-poppins text-body-4 text-destructive"
							>
								{error}
							</Animated.Text>
						) : null}

						<View className="mt-2 w-full">
							<GradientPillButton
								label={isLoading || isSubmittingLogin ? "LOGIN..." : "LOGIN"}
								onPress={submitLogin}
								disabled={isLoading || isSubmittingLogin}
							/>
						</View>

						<View
							className={cn(
								"items-center",
								isCompactHeight ? "mt-10" : "mt-12",
							)}
						>
							<Text className="text-center font-poppins text-body-3 text-text">
								Du hast keinen Account?
							</Text>
							<Pressable
								accessibilityLabel="Jetzt registrieren"
								accessibilityRole="button"
								hitSlop={8}
								onPress={() => router.push("/onboarding")}
							>
								<Text className="text-center font-poppins text-body-3 text-primary">
									Jetzt Registrieren
								</Text>
							</Pressable>
						</View>
					</View>
				</KeyboardSafeScrollView>
			</View>
		</View>
	);
}

function PasswordResetScreen({
	initialEmail,
	onCancel,
}: {
	initialEmail: string;
	onCancel: () => void;
}) {
	const { colors: COLORS } = useDayovaTheme();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const isCompactHeight = height < 850;
	const [stage, setStage] = useState<PasswordResetStage>("email");
	const [email, setEmail] = useState(initialEmail.trim().toLowerCase());
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const codeInputRef = useRef<TextInput | null>(null);
	const codeSubmittedRef = useRef(false);
	const requestInFlightRef = useRef(false);
	const {
		isLoading,
		startPasswordReset,
		verifyPasswordResetCode,
		completePasswordReset,
		verifyPasswordResetSecondFactor,
		resendPasswordResetCode,
		cancelPasswordReset,
	} = useAuthFlow();

	useEffect(() => {
		if (stage !== "reset_code" && stage !== "second_factor") return;
		const frame = requestAnimationFrame(() => codeInputRef.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, [stage]);

	const handleBack = useCallback(() => {
		if (requestInFlightRef.current || isLoading) return true;
		Keyboard.dismiss();
		setError(null);
		setNotice(null);
		requestInFlightRef.current = true;
		void cancelPasswordReset()
			.then(() => {
				if (stage === "reset_code") {
					setStage("email");
					setCode("");
					codeSubmittedRef.current = false;
					return;
				}

				onCancel();
			})
			.catch(() => {
				setError("Die Passwortzurücksetzung konnte nicht abgebrochen werden.");
			})
			.finally(() => {
				requestInFlightRef.current = false;
			});
		return true;
	}, [cancelPasswordReset, isLoading, onCancel, stage]);

	useBackIntent(true, handleBack);

	const sendResetCode = async () => {
		if (requestInFlightRef.current) return;
		const normalizedEmail = email.trim().toLowerCase();
		setError(null);
		setNotice(null);
		if (!isValidEmail(normalizedEmail)) {
			setError("Bitte gib eine gültige E-Mail-Adresse ein.");
			return;
		}

		Keyboard.dismiss();
		requestInFlightRef.current = true;
		try {
			await startPasswordReset(normalizedEmail);
			setEmail(normalizedEmail);
			setCode("");
			codeSubmittedRef.current = false;
			setStage("reset_code");
		} catch (resetError) {
			setError(
				resetError instanceof Error
					? resetError.message
					: "Der Zurücksetzungscode konnte nicht gesendet werden.",
			);
		} finally {
			requestInFlightRef.current = false;
		}
	};

	const submitCode = async (submittedCode = code) => {
		if (codeSubmittedRef.current || requestInFlightRef.current || isLoading)
			return;
		if (submittedCode.length !== CODE_LENGTH) {
			setError("Bitte gib den sechsstelligen Code ein.");
			return;
		}

		codeSubmittedRef.current = true;
		requestInFlightRef.current = true;
		setError(null);
		setNotice(null);
		Keyboard.dismiss();
		try {
			if (stage === "second_factor") {
				await verifyPasswordResetSecondFactor(submittedCode);
				router.replace(PASSWORD_RESET_SUCCESS_PATH);
				return;
			}

			await verifyPasswordResetCode(submittedCode);
			setCode("");
			codeSubmittedRef.current = false;
			setStage("new_password");
		} catch (verificationError) {
			codeSubmittedRef.current = false;
			setCode("");
			setError(
				verificationError instanceof Error
					? verificationError.message
					: "Der Code konnte nicht bestätigt werden.",
			);
			requestAnimationFrame(() => codeInputRef.current?.focus());
		} finally {
			requestInFlightRef.current = false;
		}
	};

	const submitNewPassword = async () => {
		if (requestInFlightRef.current) return;
		setError(null);
		setNotice(null);
		if (!meetsPasswordRequirements(password)) {
			setError("Bitte gib ein Passwort mit mindestens 8 Zeichen ein.");
			return;
		}
		if (password !== confirmPassword) {
			setError("Die Passwörter stimmen nicht überein.");
			return;
		}

		Keyboard.dismiss();
		requestInFlightRef.current = true;
		try {
			const result = await completePasswordReset(password);
			if (result.status === "complete") {
				router.replace(PASSWORD_RESET_SUCCESS_PATH);
				return;
			}

			setCode("");
			codeSubmittedRef.current = false;
			setNotice(
				"Zum Schutz deines Kontos haben wir dir einen weiteren Code gesendet.",
			);
			setStage("second_factor");
		} catch (resetError) {
			setError(
				resetError instanceof Error
					? resetError.message
					: "Das Passwort konnte nicht zurückgesetzt werden.",
			);
		} finally {
			requestInFlightRef.current = false;
		}
	};

	const resendCode = async () => {
		if (
			requestInFlightRef.current ||
			codeSubmittedRef.current ||
			(stage !== "reset_code" && stage !== "second_factor")
		)
			return;
		setError(null);
		setNotice(null);
		requestInFlightRef.current = true;
		try {
			await resendPasswordResetCode(stage);
			setNotice(
				"Falls ein Konto existiert, haben wir einen neuen Code per E-Mail gesendet.",
			);
		} catch (resendError) {
			setError(
				resendError instanceof Error
					? resendError.message
					: "Code konnte nicht erneut gesendet werden.",
			);
		} finally {
			requestInFlightRef.current = false;
		}
	};

	const title =
		stage === "email"
			? "Passwort vergessen?"
			: stage === "new_password"
				? "Neues Passwort"
				: stage === "second_factor"
					? "Sicherheitsprüfung"
					: "Prüfe deine E-Mail";
	const subtitle =
		stage === "email"
			? "Gib deine E-Mail-Adresse ein. Falls ein Konto existiert, senden wir dir einen sechsstelligen Code."
			: stage === "reset_code"
				? `Falls ein Konto für ${email} existiert, haben wir einen sechsstelligen Code gesendet.`
				: stage === "new_password"
					? "Wähle ein neues Passwort mit mindestens 8 Zeichen."
					: "Gib den zusätzlichen Sicherheitscode aus deiner E-Mail ein.";
	const buttonLabel =
		stage === "email"
			? "CODE SENDEN"
			: stage === "new_password"
				? "PASSWORT SPEICHERN"
				: stage === "second_factor"
					? "SICHERHEITSCODE PRÜFEN"
					: "CODE PRÜFEN";

	const runPrimaryAction = () => {
		if (stage === "email") {
			void sendResetCode();
			return;
		}
		if (stage === "new_password") {
			void submitNewPassword();
			return;
		}
		void submitCode();
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ title: "Passwort zurücksetzen" }} />
			<ThemedStatusBar />
			<KeyboardSafeScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="never"
				alwaysBounceVertical={false}
				contentContainerStyle={{
					flexGrow: 1,
					// Safe-area padding is runtime device geometry.
					paddingTop: Math.max(insets.top + 20, 40),
					paddingBottom: Math.max(insets.bottom + 24, 40),
				}}
			>
				<View className="flex-1 items-center px-8">
					<View className="w-full flex-row items-center">
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Zurück"
							disabled={isLoading}
							hitSlop={8}
							onPress={handleBack}
							className="h-12 w-12 items-center justify-center rounded-full border border-border bg-surface"
						>
							<ArrowLeft size={20} color={COLORS.text} strokeWidth={2.2} />
						</Pressable>
					</View>

					<Image
						source={require("../../../assets/dayova-logo.png")}
						resizeMode="contain"
						className={cn(
							isCompactHeight ? "mt-1 h-24 w-24" : "mt-3 h-28 w-28",
						)}
					/>
					<Text
						accessibilityRole="header"
						className="mt-5 text-center font-poppins font-semibold text-heading-2 text-text"
					>
						{title}
					</Text>
					<Text className="mt-2 max-w-[330px] text-center font-poppins text-body-3 text-secondary-text">
						{subtitle}
					</Text>

					<Animated.View
						key={stage}
						entering={FadeInDown.duration(260)}
						className="mt-8 w-full gap-4"
					>
						{stage === "email" ? (
							<FormPill
								accessibilityLabel="E-Mail-Adresse"
								value={email}
								placeholder="max.mustermann@gmail.com"
								keyboardType="email-address"
								autoCapitalize="none"
								autoComplete="email"
								textContentType="emailAddress"
								returnKeyType="send"
								onChangeText={setEmail}
								onSubmitEditing={() => void sendResetCode()}
							/>
						) : null}

						{stage === "reset_code" || stage === "second_factor" ? (
							<OtpCodeInput
								value={code}
								inputRef={codeInputRef}
								disabled={isLoading}
								onChangeText={(value) => {
									const sanitized = value
										.replace(/\D/g, "")
										.slice(0, CODE_LENGTH);
									setCode(sanitized);
									if (sanitized.length === CODE_LENGTH) {
										void submitCode(sanitized);
									}
								}}
							/>
						) : null}

						{stage === "new_password" ? (
							<>
								<FormPill
									accessibilityLabel="Neues Passwort"
									value={password}
									placeholder="Neues Passwort"
									secureTextEntry={!passwordVisible}
									autoCapitalize="none"
									autoComplete="new-password"
									textContentType="newPassword"
									onChangeText={setPassword}
									onSubmitEditing={() => Keyboard.dismiss()}
									rightAccessory={
										<PasswordVisibilityButton
											fieldLabel="Passwort"
											visible={passwordVisible}
											onToggle={() => setPasswordVisible((current) => !current)}
										/>
									}
								/>
								<FormPill
									accessibilityLabel="Neues Passwort wiederholen"
									value={confirmPassword}
									placeholder="Passwort wiederholen"
									secureTextEntry={!confirmPasswordVisible}
									autoCapitalize="none"
									autoComplete="new-password"
									textContentType="newPassword"
									returnKeyType="done"
									onChangeText={setConfirmPassword}
									onSubmitEditing={() => void submitNewPassword()}
									rightAccessory={
										<PasswordVisibilityButton
											fieldLabel="Passwortbestätigung"
											visible={confirmPasswordVisible}
											onToggle={() =>
												setConfirmPasswordVisible((current) => !current)
											}
										/>
									}
								/>
							</>
						) : null}
					</Animated.View>

					{error ? (
						<Animated.Text
							selectable
							accessibilityLiveRegion="polite"
							accessibilityRole="alert"
							entering={FadeIn.duration(180)}
							className="mt-4 text-center font-poppins text-body-4 text-wrong"
						>
							{error}
						</Animated.Text>
					) : null}
					{notice ? (
						<Animated.Text
							selectable
							accessibilityLiveRegion="polite"
							entering={FadeIn.duration(180)}
							className="mt-4 text-center font-poppins text-body-4 text-primary"
						>
							{notice}
						</Animated.Text>
					) : null}

					<View className="mt-6 w-full">
						<GradientPillButton
							label={isLoading ? `${buttonLabel}...` : buttonLabel}
							disabled={isLoading}
							onPress={runPrimaryAction}
						/>
					</View>

					{stage === "reset_code" || stage === "second_factor" ? (
						<Pressable
							accessibilityLabel="Code erneut senden"
							accessibilityRole="button"
							accessibilityState={{ disabled: isLoading }}
							disabled={isLoading}
							hitSlop={8}
							onPress={() => void resendCode()}
							className="mt-5 p-2"
						>
							<Text className="font-poppins text-body-3 text-primary">
								Code erneut senden
							</Text>
						</Pressable>
					) : null}
				</View>
			</KeyboardSafeScrollView>
		</View>
	);
}

function VerificationScreen({
	email,
	code,
	error,
	disabled,
	inputRef,
	progress,
	topInset,
	bottomInset,
	onBack,
	onChangeCode,
	onResend,
}: {
	email: string;
	code: string;
	error: string | null;
	disabled: boolean;
	inputRef: RefObject<TextInput | null>;
	progress: number;
	topInset: number;
	bottomInset: number;
	onBack: () => boolean;
	onChangeCode: (value: string) => void;
	onResend: () => Promise<void>;
}) {
	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ title: "E-Mail bestätigen", gestureEnabled: false }}
			/>
			<ThemedStatusBar />
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1"
			>
				<ScrollView
					testID="onboarding-verification-scroll"
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
					contentInsetAdjustmentBehavior="never"
					contentContainerStyle={{
						flexGrow: 1,
						paddingTop: Math.max(topInset + 12, 20),
						paddingBottom: Math.max(bottomInset + 12, 20),
						paddingHorizontal: 24,
					}}
				>
					<AuthProgressHeader
						progress={progress}
						progressLabel="Fast geschafft"
						onBack={onBack}
					/>
					<View style={{ flex: 1, alignItems: "center", paddingTop: 38 }}>
						<Text
							accessibilityRole="header"
							className="text-center font-poppins font-semibold text-text"
							style={{ fontSize: 25, lineHeight: 32 }}
						>
							E-Mail bestätigen
						</Text>
						<Text className="mt-3 max-w-[260px] text-center font-poppins text-body-5 text-text">
							Gib den 6-stelligen Code ein, den wir{"\n"}an {email}
							{"\n"}
							gesendet haben
						</Text>

						<View style={{ marginTop: 22, width: "100%" }}>
							<OtpCodeInput
								value={code}
								onChangeText={onChangeCode}
								inputRef={inputRef}
								disabled={disabled}
							/>
						</View>

						<Text className="mt-5 text-center font-poppins text-body-5 text-text">
							Kein Code angekommen?
						</Text>
						<Pressable
							accessibilityLabel="Code erneut senden"
							accessibilityRole="button"
							accessibilityState={{ disabled }}
							disabled={disabled}
							hitSlop={8}
							onPress={() => void onResend()}
						>
							<Text className="text-center font-poppins font-semibold text-body-5 text-primary">
								Erneut senden
							</Text>
						</Pressable>

						{error ? (
							<Animated.Text
								accessibilityLiveRegion="polite"
								accessibilityRole="alert"
								selectable
								entering={FadeIn.duration(180)}
								style={{
									marginTop: 12,
									fontFamily: "Poppins",
									fontSize: 12,
									lineHeight: 18,
									textAlign: "center",
									color: COLORS.destructive,
								}}
							>
								{error}
							</Animated.Text>
						) : null}
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
}

export function CreationLoaderScreen({
	topInset,
	bottomInset,
	isComplete,
}: {
	topInset: number;
	bottomInset: number;
	isComplete: boolean;
}) {
	useEffect(() => {
		if (!isComplete) return;

		const timeout = setTimeout(() => {
			router.replace("/trial");
		}, 1800);

		return () => clearTimeout(timeout);
	}, [isComplete]);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ title: "Konto einrichten", gestureEnabled: false }}
			/>
			<ThemedStatusBar />
			<View
				style={{
					flex: 1,
					paddingTop: Math.max(topInset + 24, 36),
					paddingBottom: Math.max(bottomInset + 22, 32),
					paddingHorizontal: 26,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<AnimatedFlowerLoader size={220} />
				<Animated.Text
					key={isComplete ? "complete" : "creating"}
					entering={FadeIn.duration(220)}
					className="mt-10 text-center font-poppins font-semibold text-text"
					style={{ fontSize: 20, lineHeight: 29 }}
				>
					{isComplete
						? "Alles bereit.\nStarte jetzt mit deiner ersten Prüfung."
						: "Dein Konto wird\nfür dich eingerichtet."}
				</Animated.Text>
			</View>
		</View>
	);
}

function AuthProgressHeader({
	progress,
	progressLabel,
	onBack,
	disabled = false,
}: {
	progress: number;
	progressLabel?: string;
	onBack: () => boolean;
	disabled?: boolean;
}) {
	const { colors: COLORS } = useDayovaTheme();

	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Zurück"
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={() => onBack()}
				style={{
					width: 48,
					height: 48,
					borderRadius: 24,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: COLORS.surface,
					borderWidth: 1,
					borderColor: "rgba(17, 24, 39, 0.06)",
				}}
			>
				<ArrowLeft size={18} color={COLORS.text} strokeWidth={2.2} />
			</Pressable>
			<View className="flex-1 gap-2">
				<View className="flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-body-5 text-secondary-text">
						DEIN PROFIL
					</Text>
					{progressLabel ? (
						<Text className="font-poppins text-body-5 text-secondary-text">
							{progressLabel}
						</Text>
					) : null}
				</View>
				<FlowProgressBar
					progress={progress}
					accessible
					accessibilityLabel={`Fortschritt ${Math.round(Math.min(Math.max(progress, 0), 1) * 100)} Prozent`}
					accessibilityRole="progressbar"
					accessibilityValue={{
						min: 0,
						max: 100,
						now: Math.round(Math.min(Math.max(progress, 0), 1) * 100),
					}}
				/>
			</View>
		</View>
	);
}

function PillTextInput({
	refObject,
	value,
	accessibilityLabel,
	placeholder,
	secure,
	keyboardType,
	autoComplete,
	textContentType,
	autoCapitalize,
	accessory,
	disabled = false,
	onChangeText,
	onSubmit,
}: {
	refObject: RefObject<TextInput | null>;
	value: string;
	accessibilityLabel: string;
	placeholder: string;
	secure?: boolean;
	keyboardType?: TextInputProps["keyboardType"];
	autoComplete?: TextInputProps["autoComplete"];
	textContentType?: TextInputProps["textContentType"];
	autoCapitalize?: TextInputProps["autoCapitalize"];
	accessory?: ReactNode;
	disabled?: boolean;
	onChangeText: (value: string) => void;
	onSubmit: () => void;
}) {
	const { colors: COLORS } = useDayovaTheme();

	return (
		<View
			style={{
				width: "100%",
				maxWidth: 345,
				minHeight: 64,
				borderRadius: 32,
				borderWidth: 1,
				borderColor: COLORS.primary,
				backgroundColor: COLORS.surface,
				flexDirection: "row",
				alignItems: "center",
				paddingLeft: 20,
				paddingRight: 12,
			}}
		>
			<TextInput
				ref={refObject}
				accessibilityLabel={accessibilityLabel}
				accessibilityState={{ busy: disabled, disabled }}
				editable={!disabled}
				value={value}
				placeholder={placeholder}
				placeholderTextColor={COLORS.secondaryText}
				keyboardType={keyboardType}
				autoComplete={autoComplete}
				textContentType={textContentType}
				autoCapitalize={autoCapitalize}
				autoCorrect={false}
				secureTextEntry={secure}
				returnKeyType="done"
				onChangeText={onChangeText}
				onSubmitEditing={onSubmit}
				selectionColor={COLORS.primary}
				style={{
					flex: 1,
					height: 62,
					fontFamily: "Poppins",
					fontSize: 16,
					color: COLORS.text,
					padding: 0,
					includeFontPadding: false,
				}}
			/>
			{accessory}
		</View>
	);
}

function FormPill({
	rightAccessory,
	...props
}: TextInputProps & { rightAccessory?: ReactNode }) {
	const { colors: COLORS } = useDayovaTheme();

	return (
		<View className="h-14 flex-row items-center rounded-full border border-primary bg-surface px-4">
			<TextInput
				placeholderTextColor={COLORS.secondaryText}
				selectionColor={COLORS.primary}
				autoCorrect={false}
				className="flex-1 font-poppins text-body-2 text-text"
				// Android font padding and the native input's default padding must be reset.
				style={{
					height: "100%",
					padding: 0,
					includeFontPadding: false,
					textAlignVertical: "center",
				}}
				{...props}
			/>
			{rightAccessory ? <View className="ml-2">{rightAccessory}</View> : null}
		</View>
	);
}

function OtpCodeInput({
	value,
	onChangeText,
	inputRef,
	disabled,
}: {
	value: string;
	onChangeText: (value: string) => void;
	inputRef: RefObject<TextInput | null>;
	disabled: boolean;
}) {
	const { colors: COLORS } = useDayovaTheme();

	return (
		<View>
			<View style={{ flexDirection: "row", gap: 8 }}>
				{OTP_CELL_KEYS.map((cellKey, index) => {
					const symbol = value[index] ?? "";
					const focused =
						!disabled &&
						(value.length === index ||
							(value.length === CODE_LENGTH && index === CODE_LENGTH - 1));
					return (
						<View
							key={cellKey}
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							style={{
								flex: 1,
								height: 42,
								borderRadius: 8,
								backgroundColor: COLORS.surface,
								alignItems: "center",
								justifyContent: "center",
								borderWidth: focused ? 1.4 : 1,
								borderColor: focused ? COLORS.primary : COLORS.border,
							}}
						>
							<Text
								className="text-center font-poppins font-semibold text-text"
								style={{
									fontSize: 22,
									lineHeight: 28,
									fontVariant: ["tabular-nums"],
								}}
							>
								{symbol}
							</Text>
						</View>
					);
				})}
			</View>
			<TextInput
				ref={inputRef}
				accessibilityLabel="Bestätigungscode"
				accessibilityHint="Gib den sechsstelligen Code ein."
				accessibilityState={{ disabled }}
				value={value}
				onChangeText={onChangeText}
				editable={!disabled}
				keyboardType="number-pad"
				textContentType="oneTimeCode"
				autoComplete={otpAutoComplete}
				autoCorrect={false}
				autoCapitalize="none"
				caretHidden
				className="absolute inset-0 opacity-[0.01]"
				maxLength={CODE_LENGTH}
				selectionColor="transparent"
			/>
		</View>
	);
}

function WheelAnswer({ step }: { step: WheelStep }) {
	const { answers, setAnswer } = useOnboarding();
	const [pickerTarget, setPickerTarget] = useState<"birthDate" | null>(null);

	if (step.field === "birthDate") {
		const value = answers.birthDate;
		const selectedDate = parsePickerDate(value || DEFAULT_BIRTH_DATE);
		const handleChange = (event: DateTimePickerEvent, nextDate?: Date) => {
			if (Platform.OS === "android") setPickerTarget(null);
			if (event.type === "dismissed" || !nextDate) return;
			setAnswer("birthDate", formatPickerDate(nextDate));
		};

		return (
			<View className="w-full items-center">
				<PickerInputTrigger
					accessibilityLabel="Geburtsdatum auswählen"
					value={value}
					placeholder="Geburtsdatum auswählen"
					onPress={() => setPickerTarget("birthDate")}
				/>
				{pickerTarget === "birthDate" ? (
					<DateTimePickerSheet
						visible
						value={selectedDate}
						mode="date"
						maximumDate={new Date()}
						onChange={handleChange}
						onClose={() => {
							if (!value) {
								setAnswer("birthDate", formatPickerDate(selectedDate));
							}
							setPickerTarget(null);
						}}
					/>
				) : null}
			</View>
		);
	}

	if (step.field === "grade") {
		return (
			<OnboardingSelect
				accessibilityLabel="Klassenstufe auswählen"
				value={answers.grade}
				options={GRADE_OPTIONS}
				formatLabel={(grade) => `${grade}. Klasse`}
				testID="onboarding-grade-picker"
				title="Klassenstufe auswählen"
				onChange={(value) => setAnswer("grade", value)}
			/>
		);
	}

	if (step.field === "schoolType") {
		return (
			<OnboardingSelect
				accessibilityLabel="Schulart auswählen"
				value={answers.schoolType}
				options={SCHOOL_TYPE_VALUES}
				formatLabel={(schoolType) =>
					SCHOOL_TYPE_OPTIONS.find((option) => option.value === schoolType)
						?.label ?? schoolType
				}
				testID="onboarding-school-type-picker"
				title="Schulart auswählen"
				onChange={(value) => setAnswer("schoolType", value)}
			/>
		);
	}

	return (
		<OnboardingSelect
			accessibilityLabel="Bundesland auswählen"
			value={answers.state}
			options={GERMAN_FEDERAL_STATES}
			testID="onboarding-state-picker"
			title="Bundesland auswählen"
			onChange={(value) => setAnswer("state", value)}
		/>
	);
}

function AuthChoicePillButton({
	label,
	onPress,
	scale,
	tone,
}: {
	label: string;
	onPress: () => void;
	scale: number;
	tone: "gradient" | "dark";
}) {
	const height = AUTH_CHOICE_FRAME.buttons.height * scale;

	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			onPress={onPress}
			style={{
				height,
				borderRadius: height / 2,
				overflow: "hidden",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: tone === "dark" ? COLORS.buttonNeutral : "transparent",
			}}
		>
			{tone === "gradient" ? (
				<LinearGradient
					colors={PRIMARY_GRADIENT.colors}
					start={PRIMARY_GRADIENT.start}
					end={PRIMARY_GRADIENT.end}
					style={{
						position: "absolute",
						top: 0,
						right: 0,
						bottom: 0,
						left: 0,
					}}
				/>
			) : null}
			<Text
				className="font-poppins font-semibold"
				style={{
					color: COLORS.surface,
					fontSize: 16 * scale,
					lineHeight: 24 * scale,
					includeFontPadding: false,
					textAlignVertical: "center",
				}}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function GradientPillButton({
	label,
	onPress,
	disabled,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={{
				height: 56,
				borderRadius: 28,
				overflow: "hidden",
				alignItems: "center",
				justifyContent: "center",
				opacity: disabled ? 0.55 : 1,
			}}
		>
			<LinearGradient
				colors={PRIMARY_GRADIENT.colors}
				start={PRIMARY_GRADIENT.start}
				end={PRIMARY_GRADIENT.end}
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 0,
					bottom: 0,
				}}
			/>
			<Text className="font-poppins font-semibold text-body-2 text-white">
				{label}
			</Text>
		</Pressable>
	);
}

function DarkPillButton({
	label,
	onPress,
	disabled,
	busy = false,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	busy?: boolean;
}) {
	const { colors: COLORS, isDark } = useDayovaTheme();

	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			accessibilityState={{ busy, disabled }}
			disabled={disabled}
			onPress={onPress}
			style={{
				height: 56,
				borderRadius: 28,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: isDark ? COLORS.primaryStrong : COLORS.buttonNeutral,
				boxShadow: disabled
					? "none"
					: isDark
						? "0 8px 18px rgba(0, 160, 230, 0.18)"
						: "0 8px 18px rgba(20, 28, 48, 0.08)",
			}}
		>
			<Text className="font-poppins font-semibold text-body-2 text-white">
				{label}
			</Text>
		</Pressable>
	);
}

function AuthBackgroundPattern({
	scale,
	yOffset,
}: {
	scale: number;
	yOffset: number;
}) {
	const items = [
		{
			key: "palette-top",
			x: AUTH_BACKGROUND_TILE.leftX,
			y: 28,
			icon: Palette,
		},
		{
			key: "globe-top",
			x: AUTH_BACKGROUND_TILE.centerX,
			y: 44,
			icon: Globe,
		},
		{
			key: "telescope-top",
			x: AUTH_BACKGROUND_TILE.rightX,
			y: 26,
			icon: Telescope,
		},
		{
			key: "plant-mid",
			x: AUTH_BACKGROUND_TILE.leftX,
			y: 196,
			icon: Plant,
		},
		{
			key: "helmet-mid",
			x: AUTH_BACKGROUND_TILE.rightX,
			y: 188,
			icon: GreekHelmet,
		},
		{
			key: "atom-bottom",
			x: AUTH_BACKGROUND_TILE.leftX,
			y: 360,
			icon: Atom,
		},
		{
			key: "square-root-bottom",
			x: AUTH_BACKGROUND_TILE.rightX,
			y: 350,
			icon: SquareRootSquare,
		},
	] as const;

	return (
		<View className="flex-1">
			{items.map((item) => {
				const Icon = item.icon;
				return (
					<View
						key={item.key}
						style={{
							position: "absolute",
							left: item.x * scale,
							top: (item.y + yOffset) * scale,
							width: AUTH_BACKGROUND_TILE.size * scale,
							height: AUTH_BACKGROUND_TILE.size * scale,
							borderRadius: AUTH_BACKGROUND_TILE.radius * scale,
							overflow: "hidden",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<LinearGradient
							colors={AUTH_BACKGROUND_TILE.fillColors}
							style={{
								position: "absolute",
								top: 0,
								right: 0,
								bottom: 0,
								left: 0,
							}}
						/>
						<Icon
							size={AUTH_BACKGROUND_TILE.iconSize * scale}
							color="rgba(26,26,26,0.14)"
							strokeWidth={1.8 * scale}
						/>
					</View>
				);
			})}
		</View>
	);
}
