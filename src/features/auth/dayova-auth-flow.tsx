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
	type FlatList,
	Image,
	Keyboard,
	KeyboardAvoidingView,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Platform,
	Pressable,
	ScrollView,
	TextInput,
	type TextInputProps,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	Easing,
	FadeIn,
	FadeInDown,
	FadeInUp,
	interpolateColor,
	type SharedValue,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IntroUploadArtwork } from "~/components/intro-upload-artwork";
import {
	BIRTH_MONTH_OPTIONS,
	getBirthDayValues,
	getBirthMonthValues,
	getBirthYearValues,
} from "~/components/onboarding/birth-date";
import {
	getIntroDotWidth,
	INTRO_DOT_COLLAPSED_WIDTH,
	INTRO_DOT_EXPANDED_WIDTH,
} from "~/components/onboarding/intro-pagination";
import { IntroPlanArtwork } from "~/components/onboarding/intro-plan-artwork";
import { IntroTasksArtwork } from "~/components/onboarding/intro-tasks-artwork";
import { OnboardingEdgeBackGesture } from "~/components/onboarding/onboarding-edge-back-gesture";
import {
	getNextOnboardingStepIndex,
	getOnboardingPersistenceAnswers,
	getOnboardingRegistrationPayload,
	getOnboardingStepDecision,
	isOnboardingStepReady,
} from "~/components/onboarding/onboarding-flow";
import {
	dateForOnboardingTime,
	formatOnboardingTime,
	getDefaultOnboardingLearningStartTime,
	getOnboardingLearningTimeSummary,
	getOnboardingLearningTimeValidationError,
	ONBOARDING_DURATION_OPTIONS,
	parseOnboardingStudyDays,
	toggleOnboardingStudyDay,
} from "~/components/onboarding/onboarding-learning-times";
import { OnboardingSelect } from "~/components/onboarding/onboarding-select";
import { StudyTimeFactContent } from "~/components/onboarding/study-time-fact-content";
import { AnimatedFlowerLoader } from "~/components/ui/animated-flower-loader";
import { BackButton, Button } from "~/components/ui/button";
import {
	type DateTimePickerEvent,
	DateTimePickerSheet,
} from "~/components/ui/date-time-picker-sheet";
import { ErrorMessage } from "~/components/ui/error-message";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import {
	ArrowLeft,
	Atom,
	CalendarDays,
	Check,
	CircleAlert,
	Clock3,
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
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { SnapCarouselSelector } from "~/components/ui/snap-carousel-selector";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthFlow, useAuthSession } from "~/context/AuthContext";
import { useOnboarding } from "~/context/OnboardingContext";
import { getResponsiveAuthChoiceLayout } from "~/features/auth/auth-content-size-layout";
import {
	LEARNING_DAYS,
	type LearningDayLabel,
} from "~/features/learning-times/learning-time-days";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { PASSWORD_RESET_SUCCESS_PATH } from "~/lib/auth-routing";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { GERMAN_FEDERAL_STATES } from "~/lib/federal-states";
import { GRADE_OPTIONS } from "~/lib/grades";
import { useBackIntent } from "~/lib/navigation";
import { meetsPasswordRequirements } from "~/lib/password-validation";
import {
	type RegistrationStage,
	shouldEnableRegistrationEdgeBack,
	shouldEnableRegistrationRouteBack,
	shouldHandleRegistrationBack,
} from "~/lib/registration-navigation";
import { SCHOOL_TYPE_OPTIONS, SCHOOL_TYPE_VALUES } from "~/lib/school-types";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

// Password icons represent the current visibility state across this auth flow.
// Decision: https://app.notion.com/p/39f2e87228bf81c28511c0728134c774
const COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const PRIMARY_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const STUDY_DAY_SELECTION_DURATION_MS = 180;
const STUDY_DAY_PRESS_IN_DURATION_MS = 80;
const STUDY_DAY_PRESS_OUT_DURATION_MS = 120;
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
	id: "intro-upload" | "intro-path" | "intro-tasks";
	title: string;
	description: string;
	illustration: "plan" | "tasks" | "upload";
};

type RangeStep = {
	kind: "range";
	id: "studyTime";
	title: string;
	description: string;
	field: "studyTime";
	values: readonly number[];
};

type FactStep = {
	kind: "fact";
	id: "study-time-fact";
	title: string;
	description: string;
};

type DaysStep = {
	kind: "days";
	id: "studyDays";
	title: string;
	description: string;
	field: "studyDays";
};

type TimeStep = {
	kind: "time";
	id: "learningTime";
	title: string;
	description: string;
	field: "learningTime";
};

type PayoffStep = {
	kind: "payoff";
	id: "learning-time-payoff";
	title: string;
	description: string;
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
	id:
		| "state"
		| "schoolType"
		| "grade"
		| "birthYear"
		| "birthMonth"
		| "birthDay";
	title: string;
	description: string;
	field:
		| "state"
		| "schoolType"
		| "grade"
		| "birthYear"
		| "birthMonth"
		| "birthDay";
};

type OnboardingStep =
	| IntroStep
	| RangeStep
	| FactStep
	| DaysStep
	| TimeStep
	| PayoffStep
	| TextStep
	| WheelStep;

const INTRO_STEPS = [
	{
		kind: "intro",
		id: "intro-tasks",
		title: "Du weißt, was heute wirklich zählt.",
		description:
			"Ein machbarer nächster Lernschritt bringt dich jeden Tag näher an deine Prüfung.",
		illustration: "tasks",
	},
	{
		kind: "intro",
		id: "intro-upload",
		title: "Deine Prüfung. Alles an einem Ort.",
		description:
			"Lade Aufgaben, Mitschriften und Lernmaterial hoch. Dayova verbindet sie mit deinem echten Prüfungsziel.",
		illustration: "upload",
	},
	{
		kind: "intro",
		id: "intro-path",
		title: "Aus Stoff wird ein klarer Weg.",
		description:
			"Dayova erkennt Themen und Lücken und ordnet sie so, dass du nicht mehr raten musst, wo du anfängst.",
		illustration: "plan",
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
		kind: "range",
		id: "studyTime",
		title: "Wie lange möchtest du pro Lerntag einplanen?",
		description:
			"Damit legst du die Dauer deiner ersten Lernzeiten fest. Du kannst sie später ändern.",
		field: "studyTime",
		values: ONBOARDING_DURATION_OPTIONS,
	},
	{
		kind: "fact",
		id: "study-time-fact",
		title: "Dein Lernplan braucht echte Zeitfenster.",
		description: "Dauer, Tage und Uhrzeit werden im Lernplan gespeichert.",
	},
	{
		kind: "days",
		id: "studyDays",
		title: "An welchen Tagen kannst du lernen?",
		description:
			"Wähle alle passenden Tage. Für jeden entsteht dieselbe erste Lernzeit.",
		field: "studyDays",
	},
	{
		kind: "time",
		id: "learningTime",
		title: "Wann möchtest du an diesen Tagen starten?",
		description:
			"Dayova kombiniert diese Startzeit mit deiner gewählten Dauer.",
		field: "learningTime",
	},
	{
		kind: "payoff",
		id: "learning-time-payoff",
		title: "Deine Lernzeiten",
		description: "Prüfe dein wiederkehrendes Zeitfenster.",
	},
	{
		kind: "wheel",
		id: "grade",
		title: "Welche Klassenstufe besuchst du?",
		description: "Diese Angabe wird in deinem Schulprofil gespeichert.",
		field: "grade",
	},
	{
		kind: "wheel",
		id: "state",
		title: "In welchem Bundesland gehst du zur Schule?",
		description: "Diese Angabe wird in deinem Schulprofil gespeichert.",
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
		id: "birthYear",
		title: "In welchem Jahr bist du geboren?",
		description:
			"Wir fragen Jahr, Monat und Tag nacheinander – ohne Vorauswahl.",
		field: "birthYear",
	},
	{
		kind: "wheel",
		id: "birthMonth",
		title: "In welchem Monat bist du geboren?",
		description: "Damit dein Geburtsdatum eindeutig und korrekt bleibt.",
		field: "birthMonth",
	},
	{
		kind: "wheel",
		id: "birthDay",
		title: "An welchem Tag bist du geboren?",
		description: "Der letzte Teil deines Geburtsdatums.",
		field: "birthDay",
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
	const { width, height, fontScale } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const contentSizeLayout = useContentSizeLayout({
		requestedHorizontalPadding: 24,
	});
	const reducedMotion = useReducedMotion();
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
	const responsiveLayout = getResponsiveAuthChoiceLayout(fontScale);

	if (contentSizeLayout.shouldStackInlineContent) {
		return (
			<View className="flex-1 bg-background">
				<Stack.Screen options={{ title: "Dayova" }} />
				<ThemedStatusBar />
				<View pointerEvents="none" className="absolute inset-0 overflow-hidden">
					<AuthBackgroundPattern
						scale={Math.max(width / AUTH_CHOICE_FRAME.width, 0.78)}
						yOffset={AUTH_CHOICE_FRAME.patternYOffset}
					/>
				</View>
				<ScrollView
					bounces={false}
					contentInsetAdjustmentBehavior="never"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						alignItems: "center",
						alignSelf: "center",
						justifyContent: responsiveLayout.verticallyCenterContent
							? "center"
							: "flex-start",
						maxWidth: contentSizeLayout.containerMaxWidth,
						minHeight: height,
						paddingBottom: Math.max(insets.bottom + 32, 48),
						paddingHorizontal: contentSizeLayout.horizontalPadding,
						paddingTop: Math.max(insets.top + 32, 48),
						width: "100%",
					}}
				>
					<Animated.View
						testID="auth-choice-logo-card"
						entering={
							reducedMotion
								? undefined
								: FadeInDown.duration(520).springify().damping(18)
						}
						className="h-28 w-28 items-center justify-center rounded-[28px] bg-card shadow-lg"
					>
						<Image
							source={require("../../../assets/onboarding/dayova-y.png")}
							resizeMode="contain"
							className="h-[104px] w-[104px]"
						/>
					</Animated.View>

					<Text
						allowFontScaling={false}
						className="mt-6 text-center font-poppins font-semibold text-heading-1 text-text"
						style={{
							fontSize: responsiveLayout.brandFontSize,
							lineHeight: responsiveLayout.brandLineHeight,
							width: Math.min(
								Math.max(width - 16, 0),
								contentSizeLayout.containerMaxWidth,
							),
						}}
					>
						Dayova
					</Text>
					<Text
						allowFontScaling={false}
						className="mt-4 text-center font-poppins text-body-2 text-secondary-text"
						style={{
							fontSize: responsiveLayout.bodyFontSize,
							lineHeight: responsiveLayout.bodyLineHeight,
						}}
					>
						Du bist neu hier, dann registriere dich. Andernfalls willkommen
						zurück
					</Text>

					<View className="mt-8 w-full gap-3">
						<AuthChoicePillButton
							label="Registrierung"
							responsive
							scale={1}
							tone="gradient"
							onPress={() => router.push("/onboarding")}
						/>
						<AuthChoicePillButton
							label="Login"
							responsive
							scale={1}
							tone="dark"
							onPress={() => router.push("/login")}
						/>
					</View>

					<Text
						allowFontScaling={false}
						className="mt-7 w-full text-center font-poppins text-body-4 text-secondary-text"
						style={{
							fontSize: responsiveLayout.termsFontSize,
							lineHeight: responsiveLayout.termsLineHeight,
						}}
					>
						Mit dem Start akzeptierst du Daten­schutz­bestimmungen und
						Nutzungs­bedingungen.
					</Text>
				</ScrollView>
			</View>
		);
	}

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
						entering={reducedMotion ? undefined : FadeIn.duration(240)}
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
						entering={reducedMotion ? undefined : FadeInDown.duration(240)}
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
						entering={
							reducedMotion ? undefined : FadeInDown.delay(40).duration(240)
						}
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
						entering={
							reducedMotion ? undefined : FadeInDown.delay(80).duration(240)
						}
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
						entering={
							reducedMotion ? undefined : FadeInUp.delay(120).duration(240)
						}
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
	const {
		startRegistrationWithEmail,
		register,
		stageOnboardingRecovery,
		replaceOnboardingRecoveryAnswers,
		verifyEmailCode,
		resendVerification,
		isLoading,
	} = useAuthFlow();
	const {
		user,
		isConvexAuthenticated,
		isPostAuthSyncing,
		postAuthSyncError,
		retryPostAuthSync,
		onboardingCompletionStatus,
		completeOnboardingHandoff,
	} = useAuthSession();
	const { answers } = useOnboarding();
	const [recoveryAnswers, setRecoveryAnswers] = useState({
		studyTime: "",
		studyDays: "",
		learningTime: "",
	});
	const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);
	const activeStep = FLOW_STEPS[activeIndex];
	const textInputRef = useRef<TextInput | null>(null);
	const verificationInputRef = useRef<TextInput | null>(null);
	const previousAnswersRef = useRef(answers);
	const verificationSubmittedRef = useRef(false);
	const isCreationComplete = Boolean(
		(stage === "creating" || onboardingCompletionStatus !== "none") &&
			user &&
			isConvexAuthenticated &&
			onboardingCompletionStatus === "ready_for_trial" &&
			!isPostAuthSyncing &&
			!postAuthSyncError,
	);
	const isRestoringCreation = Boolean(
		user &&
			onboardingCompletionStatus !== "none" &&
			onboardingCompletionStatus !== "loading",
	);
	const isRecoveryRequired = onboardingCompletionStatus === "recovery_required";
	const registrationActionGateRef = useRef(createAsyncActionGate());
	const isRegistrationBusy = isLoading || isRegistering;

	useEffect(() => {
		if (previousAnswersRef.current === answers) return;
		previousAnswersRef.current = answers;
		setError(null);
	}, [answers]);

	useEffect(() => {
		if (stage !== "verification") return;
		const frame = requestAnimationFrame(() =>
			verificationInputRef.current?.focus(),
		);
		return () => cancelAnimationFrame(frame);
	}, [stage]);

	useEffect(() => {
		if (
			stage !== "flow" ||
			!user ||
			onboardingCompletionStatus !== "none" ||
			isPostAuthSyncing
		)
			return;

		const frame = requestAnimationFrame(() => {
			router.replace("/trial");
		});

		return () => cancelAnimationFrame(frame);
	}, [isPostAuthSyncing, onboardingCompletionStatus, stage, user]);

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
	// The async gate remains the authoritative event-time guard in handleBack;
	// render-time gesture state follows React state so it updates deterministically.
	const isBackBusy = isRegistrationBusy;
	const routeBackEnabled = shouldEnableRegistrationRouteBack(
		activeIndex,
		stage,
		isBackBusy,
	);
	const edgeBackEnabled = shouldEnableRegistrationEdgeBack({
		activeIndex,
		isBusy: isBackBusy,
		platform: Platform.OS,
		stage,
		stepKind: activeStep.kind,
	});

	const stepProgress =
		stage === "verification" || stage === "creating"
			? 1
			: Math.min(
					(activeIndex - INTRO_STEPS.length + 1) / PROFILE_STEP_COUNT,
					1,
				);

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

		if (activeStep.kind === "text" && activeStep.field === "email") {
			await registrationActionGateRef.current.run(async () => {
				try {
					await startRegistrationWithEmail(answers.email);
					setActiveIndex((current) =>
						getNextOnboardingStepIndex(current, FLOW_STEPS.length),
					);
				} catch (emailError) {
					setError(
						emailError instanceof Error
							? emailError.message
							: "E-Mail-Adresse konnte nicht geprüft werden. Bitte versuche es erneut.",
					);
				}
			});
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
				await stageOnboardingRecovery(getOnboardingPersistenceAnswers(answers));
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

	const continueToTrial = async () => {
		setError(null);
		let handedOff = false;
		try {
			handedOff = await completeOnboardingHandoff();
		} catch {
			// The local message also covers failures outside the owned outbox path.
		}
		if (handedOff) {
			router.replace("/trial");
			return;
		}
		setError(
			"Der Wechsel zur Testphase ist fehlgeschlagen. Bitte versuche es erneut.",
		);
	};

	const handleVerificationChange = (value: string) => {
		const sanitized = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
		setVerificationCode(sanitized);
		if (sanitized.length === CODE_LENGTH) {
			void submitVerificationCode(sanitized);
		}
	};

	if (stage === "creating" || isRestoringCreation) {
		if (isRecoveryRequired) {
			return (
				<OnboardingRecoveryScreen
					topInset={insets.top}
					bottomInset={insets.bottom}
					answers={recoveryAnswers}
					error={error}
					isSubmitting={isRecoverySubmitting}
					onChange={(field, value) => {
						if (isRecoverySubmitting) return;
						setRecoveryAnswers((current) => ({
							...current,
							[field]: value,
						}));
						setError(null);
					}}
					onSubmit={async () => {
						const validationError =
							getOnboardingLearningTimeValidationError(recoveryAnswers);
						if (validationError) {
							setError(validationError);
							return;
						}
						await registrationActionGateRef.current.run(async () => {
							setIsRecoverySubmitting(true);
							try {
								await replaceOnboardingRecoveryAnswers({
									dailySchoolTime: `${recoveryAnswers.studyTime} min`,
									studyDays: recoveryAnswers.studyDays,
									learningTime: recoveryAnswers.learningTime,
									state: user?.state ?? "",
									schoolType: user?.schoolType ?? "",
									grade: user?.grade ?? "",
								});
							} catch (recoveryError) {
								setError(
									recoveryError instanceof Error
										? recoveryError.message
										: "Deine Lernzeiten konnten nicht gespeichert werden.",
								);
							} finally {
								setIsRecoverySubmitting(false);
							}
						});
					}}
				/>
			);
		}
		return (
			<CreationLoaderScreen
				topInset={insets.top}
				bottomInset={insets.bottom}
				isComplete={isCreationComplete}
				error={error ?? postAuthSyncError}
				onRetry={() => {
					if (onboardingCompletionStatus === "ready_for_trial") {
						void continueToTrial();
						return;
					}
					retryPostAuthSync();
				}}
				onComplete={continueToTrial}
			/>
		);
	}

	if (stage === "verification") {
		return (
			<OnboardingEdgeBackGesture
				key={stage}
				enabled={edgeBackEnabled}
				onBack={handleBack}
			>
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
			</OnboardingEdgeBackGesture>
		);
	}

	const isIntro = activeStep.kind === "intro";

	const flowContent = isIntro ? (
		<IntroStepView
			activeIndex={activeIndex}
			topInset={insets.top}
			bottomInset={insets.bottom}
			onActiveIndexChange={setActiveIndex}
			onNext={continueFromStep}
		/>
	) : (
		<View
			style={{
				flex: 1,
				paddingTop: Math.max(insets.top + 12, 20),
				paddingHorizontal: 24,
			}}
		>
			<QuestionStepView
				step={activeStep}
				progress={stepProgress}
				stepNumber={activeIndex - INTRO_STEPS.length + 1}
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
	);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					title: "Registrierung",
					gestureEnabled: routeBackEnabled,
					fullScreenGestureEnabled: false,
				}}
			/>
			<ThemedStatusBar />
			<OnboardingEdgeBackGesture enabled={edgeBackEnabled} onBack={handleBack}>
				{isIntro ? (
					flowContent
				) : (
					<KeyboardAvoidingView
						behavior={Platform.OS === "ios" ? "padding" : undefined}
						className="flex-1"
					>
						{flowContent}
					</KeyboardAvoidingView>
				)}
			</OnboardingEdgeBackGesture>
		</View>
	);
}

function IntroStepView({
	activeIndex,
	topInset,
	bottomInset,
	onActiveIndexChange,
	onNext,
}: {
	activeIndex: number;
	topInset: number;
	bottomInset: number;
	onActiveIndexChange: (index: number) => void;
	onNext: () => void;
}) {
	const { colors: COLORS } = useDayovaTheme();
	const { width, height, fontScale } = useWindowDimensions();
	const contentSizeLayout = useContentSizeLayout({
		requestedHorizontalPadding: 24,
	});
	const listRef = useRef<FlatList<IntroStep>>(null);
	const previousWidthRef = useRef(width);
	const reducedMotion = useReducedMotion();
	const isCompactHeight = height < 760;
	const usesAccessibleContentLayout =
		contentSizeLayout.shouldStackInlineContent && fontScale > 1;
	const introIndex = Math.min(activeIndex, INTRO_STEPS.length - 1);
	const isLastIntro = introIndex === INTRO_STEPS.length - 1;
	const scrollX = useSharedValue(introIndex * width);
	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (event) => {
			scrollX.set(event.contentOffset.x);
		},
	});

	const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const index = Math.min(
			Math.max(Math.round(event.nativeEvent.contentOffset.x / width), 0),
			INTRO_STEPS.length - 1,
		);
		onActiveIndexChange(index);
	};

	const handleNext = () => {
		if (isLastIntro) {
			onNext();
			return;
		}

		onActiveIndexChange(introIndex + 1);
	};

	useEffect(() => {
		const widthChanged = previousWidthRef.current !== width;
		previousWidthRef.current = width;

		if (widthChanged || reducedMotion || usesAccessibleContentLayout) {
			scrollX.set(introIndex * width);
		}
		if (!usesAccessibleContentLayout) {
			listRef.current?.scrollToIndex({
				index: introIndex,
				animated: !widthChanged && !reducedMotion,
			});
		}
	}, [introIndex, reducedMotion, scrollX, usesAccessibleContentLayout, width]);

	if (usesAccessibleContentLayout) {
		const item = INTRO_STEPS[introIndex];
		return (
			<View
				className="flex-1"
				style={{ paddingTop: Math.max(topInset + 12, 24) }}
			>
				<ScrollView
					key={item.id}
					testID="intro-responsive-scroll"
					contentInsetAdjustmentBehavior="never"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						alignItems: "center",
						paddingBottom: Math.max(bottomInset + 20, 28),
						paddingHorizontal: contentSizeLayout.horizontalPadding,
					}}
				>
					<View className="w-full">
						<IntroArtwork accessibleLayout item={item} />
					</View>

					<Text
						accessibilityRole="header"
						className="mt-6 max-w-[350px] text-center font-poppins font-semibold text-heading-2 text-text"
					>
						{item.title}
					</Text>
					<Text className="mt-3 max-w-[340px] text-center font-poppins text-body-3 text-secondary-text">
						{item.description}
					</Text>

					<View className="mt-8 w-full">
						<IntroDots
							activeColor={COLORS.primary}
							currentIndex={introIndex}
							inactiveColor={COLORS.border}
							pageWidth={width}
							scrollX={scrollX}
						/>
						<Button
							accessibilityLabel={
								isLastIntro ? "Meinen Start personalisieren" : "Weiter"
							}
							onPress={handleNext}
						>
							<Text>
								{isLastIntro ? "Meinen Start personalisieren" : "Weiter"}
							</Text>
						</Button>
						<Text className="mt-3 text-center font-poppins text-body-5 text-secondary-text">
							Danach 14 kurze, bewusste Schritte · etwa 3 Minuten
						</Text>
					</View>
				</ScrollView>
			</View>
		);
	}

	return (
		<View
			className="flex-1"
			style={{
				paddingTop: Math.max(topInset + (isCompactHeight ? 12 : 20), 24),
				paddingBottom: Math.max(bottomInset + 20, 28),
			}}
		>
			<View className="items-center px-6">
				<View className="flex-row items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
					<Route2 size={16} color={COLORS.primary} strokeWidth={2.2} />
					<Text className="font-poppins font-semibold text-body-5 text-primary">
						SO FUNKTIONIERT DAYOVA
					</Text>
				</View>
			</View>

			<Animated.FlatList
				ref={listRef}
				testID="intro-pager"
				data={INTRO_STEPS}
				horizontal
				pagingEnabled
				bounces={false}
				initialScrollIndex={introIndex}
				initialNumToRender={INTRO_STEPS.length}
				maxToRenderPerBatch={INTRO_STEPS.length}
				removeClippedSubviews={false}
				showsHorizontalScrollIndicator={false}
				scrollEventThrottle={16}
				keyExtractor={(step) => step.id}
				getItemLayout={(_, index) => ({
					length: width,
					offset: width * index,
					index,
				})}
				onScroll={scrollHandler}
				onMomentumScrollEnd={handleScrollEnd}
				onScrollEndDrag={handleScrollEnd}
				renderItem={({ item }) => {
					// Pager width and artwork height are measured runtime geometry.
					return (
						<View style={{ width }} className="items-center px-6 pt-4">
							<IntroArtwork compactHeight={isCompactHeight} item={item} />

							<Text
								accessibilityRole="header"
								className={cn(
									"max-w-[350px] text-center font-poppins font-semibold text-text",
									isCompactHeight
										? "mt-4 text-heading-2"
										: "mt-6 text-heading-1",
								)}
							>
								{item.title}
							</Text>
							<Text className="mt-3 max-w-[340px] text-center font-poppins text-body-3 text-secondary-text">
								{item.description}
							</Text>
						</View>
					);
				}}
			/>

			<View className="px-6">
				<IntroDots
					activeColor={COLORS.primary}
					currentIndex={introIndex}
					inactiveColor={COLORS.border}
					pageWidth={width}
					scrollX={scrollX}
				/>
				<Button
					accessibilityLabel={
						isLastIntro ? "Meinen Start personalisieren" : "Weiter"
					}
					onPress={handleNext}
				>
					<Text>{isLastIntro ? "Meinen Start personalisieren" : "Weiter"}</Text>
				</Button>
				<Text className="mt-3 text-center font-poppins text-body-5 text-secondary-text">
					Danach 14 kurze, bewusste Schritte · etwa 3 Minuten
				</Text>
			</View>
		</View>
	);
}

function IntroArtwork({
	accessibleLayout = false,
	compactHeight = false,
	item,
}: {
	accessibleLayout?: boolean;
	compactHeight?: boolean;
	item: IntroStep;
}) {
	const containerHeight = accessibleLayout ? 184 : compactHeight ? 220 : 286;

	return (
		<View
			className="w-full items-center justify-center overflow-hidden rounded-[32px] bg-system-subtle"
			// Runtime content-size mode chooses the bounded decorative-artwork height.
			style={{ height: containerHeight }}
		>
			{item.illustration === "upload" ? (
				<IntroUploadArtwork
					width={accessibleLayout ? 210 : compactHeight ? 246 : 280}
					height={accessibleLayout ? 190 : compactHeight ? 222 : 254}
				/>
			) : null}
			{item.illustration === "plan" ? (
				<IntroPlanArtwork
					width={accessibleLayout ? 250 : compactHeight ? 284 : 330}
					height={accessibleLayout ? 144 : compactHeight ? 164 : 190}
				/>
			) : null}
			{item.illustration === "tasks" ? (
				<IntroTasksArtwork
					width={accessibleLayout ? 262 : compactHeight ? 294 : 345}
					height={accessibleLayout ? 178 : compactHeight ? 200 : 236}
				/>
			) : null}
		</View>
	);
}

function IntroDots({
	activeColor,
	currentIndex,
	inactiveColor,
	pageWidth,
	scrollX,
}: {
	activeColor: string;
	currentIndex: number;
	inactiveColor: string;
	pageWidth: number;
	scrollX: SharedValue<number>;
}) {
	return (
		<View
			accessible
			accessibilityLabel="Einführung"
			accessibilityRole="progressbar"
			accessibilityValue={{
				min: 1,
				max: INTRO_STEPS.length,
				now: currentIndex + 1,
				text: `Seite ${currentIndex + 1} von ${INTRO_STEPS.length}`,
			}}
			className="mb-5 flex-row items-center justify-center gap-2"
		>
			{INTRO_STEPS.map((step, index) => (
				<IntroDot
					key={step.id}
					activeColor={activeColor}
					inactiveColor={inactiveColor}
					index={index}
					pageWidth={pageWidth}
					scrollX={scrollX}
				/>
			))}
		</View>
	);
}

function IntroDot({
	activeColor,
	inactiveColor,
	index,
	pageWidth,
	scrollX,
}: {
	activeColor: string;
	inactiveColor: string;
	index: number;
	pageWidth: number;
	scrollX: SharedValue<number>;
}) {
	const animatedStyle = useAnimatedStyle(() => {
		const width = getIntroDotWidth(
			scrollX.get(),
			pageWidth,
			index,
			INTRO_STEPS.length,
		);
		const emphasis =
			(width - INTRO_DOT_COLLAPSED_WIDTH) /
			(INTRO_DOT_EXPANDED_WIDTH - INTRO_DOT_COLLAPSED_WIDTH);

		return {
			backgroundColor: interpolateColor(
				emphasis,
				[0, 1],
				[inactiveColor, activeColor],
			),
			width,
		};
	});

	return (
		<Animated.View
			testID={`intro-indicator-${index}`}
			className="h-[6px] rounded-full"
			style={animatedStyle}
		/>
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
	const { colors: COLORS, isDark } = useDayovaTheme();
	const { answers, setAnswer } = useOnboarding();
	const reducedMotion = useReducedMotion();
	const isWheelStep = step.kind === "wheel";
	const stepDecision = getOnboardingStepDecision(step, answers);
	const canContinue = isOnboardingStepReady(step, answers);
	const currentAnswer = "field" in step ? answers[step.field] : "";
	const localValidationError =
		step.kind === "text" && currentAnswer.trim() && step.field !== "password"
			? stepDecision.error
			: null;
	const visibleError = error ?? localValidationError;
	const isImmersiveStep = step.kind === "fact" || step.kind === "payoff";
	const titleTopPadding = step.kind === "text" ? 50 : 28;
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
				key={step.id}
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
					entering={reducedMotion ? undefined : FadeInDown.duration(220)}
					style={{
						flex: 1,
						alignItems: "center",
						paddingTop: isImmersiveStep ? 16 : titleTopPadding,
					}}
				>
					{!isImmersiveStep ? (
						<>
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
						</>
					) : null}

					<View
						testID="onboarding-answer-group"
						style={{
							width: "100%",
							marginTop: isImmersiveStep ? 0 : isWheelStep ? 20 : 22,
							flex: isWheelStep ? 1 : undefined,
							alignItems: "center",
							justifyContent: isWheelStep ? "center" : undefined,
						}}
					>
						{step.kind === "wheel" ? <WheelAnswer step={step} /> : null}
						{step.kind === "range" ? <RangeAnswer step={step} /> : null}
						{step.kind === "days" ? <StudyDaysAnswer /> : null}
						{step.kind === "time" ? <LearningTimeAnswer /> : null}
						{step.kind === "fact" ? (
							<StudyTimeFactContent
								title={step.title}
								studyTime={answers.studyTime}
							/>
						) : null}
						{step.kind === "payoff" ? <PayoffAnswer /> : null}

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

						{!isImmersiveStep ? (
							<View
								testID="onboarding-answer-error-slot"
								className="mt-3 min-h-8 px-3"
							>
								{visibleError ? (
									<Animated.Text
										accessibilityLiveRegion="polite"
										accessibilityRole="alert"
										selectable
										entering={reducedMotion ? undefined : FadeIn.duration(180)}
										style={{
											fontFamily: "Poppins",
											fontSize: 12,
											lineHeight: 18,
											color: COLORS.destructive,
											textAlign: "center",
										}}
									>
										{visibleError}
									</Animated.Text>
								) : null}
							</View>
						) : null}
					</View>
				</Animated.View>
			</ScrollView>

			<View
				style={{
					paddingTop: 8,
					paddingBottom: Math.max(bottomInset + 52, 60),
				}}
			>
				<Button
					accessibilityLabel={continueLabel}
					accessibilityState={{ busy, disabled: busy || !canContinue }}
					disabled={busy || !canContinue}
					variant={isDark ? "default" : "neutral"}
					onPress={() => void onContinue()}
				>
					<Text>{continueLabel}</Text>
				</Button>
			</View>
		</View>
	);
}

export function LoginScreen() {
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const reducedMotion = useReducedMotion();
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
							entering={reducedMotion ? undefined : FadeInDown.duration(240)}
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
								entering={reducedMotion ? undefined : FadeIn.duration(180)}
								className="mt-3 text-center font-poppins text-body-4 text-destructive"
							>
								{error}
							</Animated.Text>
						) : null}

						<View className="mt-2 w-full">
							<Button
								accessibilityLabel={
									isLoading || isSubmittingLogin ? "LOGIN..." : "LOGIN"
								}
								onPress={submitLogin}
								disabled={isLoading || isSubmittingLogin}
							>
								<Text>
									{isLoading || isSubmittingLogin ? "LOGIN..." : "LOGIN"}
								</Text>
							</Button>
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
	const reducedMotion = useReducedMotion();
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
						entering={reducedMotion ? undefined : FadeInDown.duration(240)}
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
							entering={reducedMotion ? undefined : FadeIn.duration(180)}
							className="mt-4 text-center font-poppins text-body-4 text-wrong"
						>
							{error}
						</Animated.Text>
					) : null}
					{notice ? (
						<Animated.Text
							selectable
							accessibilityLiveRegion="polite"
							entering={reducedMotion ? undefined : FadeIn.duration(180)}
							className="mt-4 text-center font-poppins text-body-4 text-primary"
						>
							{notice}
						</Animated.Text>
					) : null}

					<View className="mt-6 w-full">
						<Button
							accessibilityLabel={isLoading ? `${buttonLabel}...` : buttonLabel}
							disabled={isLoading}
							onPress={runPrimaryAction}
						>
							<Text>{isLoading ? `${buttonLabel}...` : buttonLabel}</Text>
						</Button>
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
	const reducedMotion = useReducedMotion();

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
								entering={reducedMotion ? undefined : FadeIn.duration(180)}
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

export function OnboardingRecoveryScreen({
	topInset,
	bottomInset,
	answers,
	error,
	isSubmitting = false,
	onChange,
	onSubmit,
}: {
	topInset: number;
	bottomInset: number;
	answers: { studyTime: string; studyDays: string; learningTime: string };
	error: string | null;
	isSubmitting?: boolean;
	onChange: (
		field: "studyTime" | "studyDays" | "learningTime",
		value: string,
	) => void;
	onSubmit: () => void | Promise<void>;
}) {
	const [pickerVisible, setPickerVisible] = useState(false);
	const [pendingTime, setPendingTime] = useState(() =>
		dateForOnboardingTime(answers.learningTime),
	);
	const selectedDays = new Set(parseOnboardingStudyDays(answers.studyDays));
	const validationError = getOnboardingLearningTimeValidationError(answers);
	const isSubmitDisabled = isSubmitting || validationError !== null;
	return (
		<View
			className="flex-1 bg-background px-6"
			style={{
				paddingTop: Math.max(topInset + 24, 36),
				paddingBottom: Math.max(bottomInset + 22, 32),
			}}
		>
			<Stack.Screen
				options={{
					title: "Lernzeiten wiederherstellen",
					gestureEnabled: false,
				}}
			/>
			<ThemedStatusBar />
			<Text
				accessibilityRole="header"
				className="mt-8 text-center font-poppins font-semibold text-heading-2 text-text"
			>
				Stelle deine Lernzeiten wieder her.
			</Text>
			<Text className="mt-3 text-center font-poppins text-body-3 text-secondary-text">
				Dein Konto ist sicher. Die letzte Übertragung deiner Lernzeiten war
				unvollständig – bitte bestätige nur diese drei Angaben erneut.
			</Text>

			<KeyboardSafeScrollView
				contentContainerStyle={{ flexGrow: 1, paddingTop: 28 }}
			>
				<Text className="font-poppins font-semibold text-body-3 text-text">
					Dauer pro Lerntag
				</Text>
				<View className="mt-3 flex-row flex-wrap gap-2">
					{ONBOARDING_DURATION_OPTIONS.map((duration) => {
						const selected = answers.studyTime === String(duration);
						return (
							<Pressable
								key={duration}
								accessibilityRole="radio"
								accessibilityState={{ disabled: isSubmitting, selected }}
								disabled={isSubmitting}
								onPress={() => onChange("studyTime", String(duration))}
								className={cn(
									"rounded-full border px-4 py-3",
									selected
										? "border-primary bg-primary"
										: "border-path-1 bg-system-subtle",
								)}
							>
								<Text
									className={cn(
										"font-poppins font-semibold text-body-4",
										selected ? "text-on-primary" : "text-text",
									)}
								>
									{duration} Minuten
								</Text>
							</Pressable>
						);
					})}
				</View>

				<Text className="mt-6 font-poppins font-semibold text-body-3 text-text">
					Lerntage
				</Text>
				<View className="mt-3 flex-row flex-wrap gap-2">
					{LEARNING_DAYS.map((day) => {
						const selected = selectedDays.has(day.label);
						return (
							<Pressable
								key={day.label}
								accessibilityRole="checkbox"
								accessibilityState={{
									checked: selected,
									disabled: isSubmitting,
								}}
								disabled={isSubmitting}
								onPress={() =>
									onChange(
										"studyDays",
										toggleOnboardingStudyDay(answers.studyDays, day.label),
									)
								}
								className={cn(
									"rounded-full border px-4 py-3",
									selected
										? "border-primary bg-primary"
										: "border-path-1 bg-system-subtle",
								)}
							>
								<Text
									className={cn(
										"font-poppins font-semibold text-body-4",
										selected ? "text-on-primary" : "text-text",
									)}
								>
									{day.label}
								</Text>
							</Pressable>
						);
					})}
				</View>

				<Text className="mt-6 font-poppins font-semibold text-body-3 text-text">
					Startzeit
				</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ disabled: isSubmitting }}
					disabled={isSubmitting}
					accessibilityLabel={
						answers.learningTime
							? `Lernzeit beginnt um ${answers.learningTime} Uhr`
							: "Startzeit auswählen"
					}
					onPress={() => {
						setPendingTime(
							dateForOnboardingTime(
								answers.learningTime || getDefaultOnboardingLearningStartTime(),
							),
						);
						setPickerVisible(true);
					}}
					className="mt-3 min-h-16 justify-center rounded-input border border-path-1 bg-system-subtle px-4"
				>
					<Text className="font-poppins font-semibold text-body-3 text-text">
						{answers.learningTime
							? `${answers.learningTime} Uhr`
							: "Uhrzeit auswählen"}
					</Text>
				</Pressable>
				{(error ?? validationError) ? (
					<ErrorMessage className="mt-4 text-center">
						{error ?? validationError}
					</ErrorMessage>
				) : null}
			</KeyboardSafeScrollView>
			<Button
				accessibilityLabel={
					isSubmitting
						? "Lernzeiten werden gespeichert"
						: "Lernzeiten erneut speichern"
				}
				disabled={isSubmitDisabled}
				onPress={onSubmit}
			>
				<Text>
					{isSubmitting
						? "Lernzeiten werden gespeichert …"
						: "Lernzeiten erneut speichern"}
				</Text>
			</Button>
			<DateTimePickerSheet
				visible={pickerVisible}
				value={pendingTime}
				mode="time"
				doneLabel="Zeit übernehmen"
				onChange={(event, selectedDate) => {
					if (event.type === "set" && selectedDate)
						setPendingTime(selectedDate);
				}}
				onClose={() => setPickerVisible(false)}
				onConfirm={(selectedDate) => {
					onChange("learningTime", formatOnboardingTime(selectedDate));
				}}
			/>
		</View>
	);
}

export function CreationLoaderScreen({
	topInset,
	bottomInset,
	isComplete,
	error = null,
	onRetry,
	onComplete,
}: {
	topInset: number;
	bottomInset: number;
	isComplete: boolean;
	error?: string | null;
	onRetry?: () => void;
	onComplete?: () => void | Promise<void>;
}) {
	const reducedMotion = useReducedMotion();
	const { colors } = useDayovaTheme();

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
				{error ? (
					<View className="h-[144px] w-[144px] items-center justify-center rounded-full bg-wrong-subtle">
						<CircleAlert size={56} color={colors.wrong} strokeWidth={1.8} />
					</View>
				) : (
					<AnimatedFlowerLoader size={220} />
				)}
				<Animated.Text
					key={error ? "error" : isComplete ? "complete" : "creating"}
					entering={reducedMotion ? undefined : FadeIn.duration(220)}
					className="mt-10 text-center font-poppins font-semibold text-text"
					style={{ fontSize: 20, lineHeight: 29 }}
				>
					{error
						? "Die Einrichtung ist noch nicht abgeschlossen."
						: isComplete
							? "Dein Konto ist bereit.\nAls Nächstes startest du deine Testphase."
							: "Dein Konto wird\nfür dich eingerichtet."}
				</Animated.Text>
				{error ? (
					<>
						<ErrorMessage className="mt-3 max-w-[340px] text-center">
							{error}
						</ErrorMessage>
						<Button
							accessibilityLabel="Erneut versuchen"
							className="mt-8 w-full"
							onPress={onRetry}
						>
							<Text>Erneut versuchen</Text>
						</Button>
					</>
				) : null}
				{isComplete ? (
					<Button
						accessibilityLabel="Weiter zur Testphase"
						className="mt-8 w-full"
						onPress={() => void onComplete?.()}
					>
						<Text>Weiter zur Testphase</Text>
					</Button>
				) : null}
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
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
			<BackButton
				accessibilityState={{ disabled }}
				disabled={disabled}
				iconSize={18}
				strokeWidth={2.2}
				onPress={() => onBack()}
			/>
			<View className="flex-1 gap-2">
				<View className="flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-body-5 text-secondary-text">
						DEIN START
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

function RangeAnswer({ step }: { step: RangeStep }) {
	const { answers, setAnswer } = useOnboarding();
	const hasExplicitSelection = answers.studyTime.trim().length > 0;
	const parsedStudyTime = Number.parseInt(answers.studyTime, 10);
	const defaultStudyTime = step.values.includes(30)
		? 30
		: (step.values[0] ?? 30);
	const normalizedStudyTime = step.values.reduce(
		(nearest, value) =>
			Math.abs(value - parsedStudyTime) < Math.abs(nearest - parsedStudyTime)
				? value
				: nearest,
		defaultStudyTime,
	);
	const displayedStudyTime = Number.isFinite(parsedStudyTime)
		? normalizedStudyTime
		: defaultStudyTime;
	useEffect(() => {
		if (
			hasExplicitSelection &&
			answers.studyTime !== String(displayedStudyTime)
		) {
			setAnswer("studyTime", String(displayedStudyTime));
		}
	}, [answers.studyTime, displayedStudyTime, hasExplicitSelection, setAnswer]);
	const selectedIndex = Math.max(step.values.indexOf(displayedStudyTime), 0);
	const selectedValue = step.values[selectedIndex] ?? step.values[0];

	return (
		<View className="w-full items-center">
			<SnapCarouselSelector
				accessibilityLabel="Tägliche Lernzeit"
				accessibilityValue={
					hasExplicitSelection
						? `${displayedStudyTime} Minuten`
						: `${displayedStudyTime} Minuten Vorschau, noch nicht ausgewählt`
				}
				decrementLabel="Weniger Lernzeit"
				incrementLabel="Mehr Lernzeit"
				items={step.values}
				selectedIndex={selectedIndex}
				getItemKey={(value) => String(value)}
				getItemPrimaryLabel={(value) => String(value)}
				getItemProgress={(_, index) => (index + 1) / step.values.length}
				primaryLabel={String(displayedStudyTime)}
				secondaryLabel="Minuten"
				progress={
					selectedValue === undefined
						? 0
						: (selectedIndex + 1) / step.values.length
				}
				onSelect={(value) => setAnswer("studyTime", String(value))}
			/>
			{hasExplicitSelection ? null : (
				<Button
					size="sm"
					accessibilityLabel={`${displayedStudyTime} Minuten auswählen`}
					className="mt-4 self-center"
					onPress={() => setAnswer("studyTime", String(displayedStudyTime))}
				>
					<Text>{displayedStudyTime} Minuten auswählen</Text>
				</Button>
			)}
		</View>
	);
}

function AnimatedStudyDayPill({
	label,
	isSelected,
	onToggle,
}: {
	label: LearningDayLabel;
	isSelected: boolean;
	onToggle: () => void;
}) {
	const { colors } = useDayovaTheme();
	const reducedMotion = useReducedMotion();
	const selectionProgress = useSharedValue(isSelected ? 1 : 0);
	const pressedScale = useSharedValue(1);

	useEffect(() => {
		const nextProgress = isSelected ? 1 : 0;
		selectionProgress.set(
			reducedMotion
				? nextProgress
				: withTiming(nextProgress, {
						duration: STUDY_DAY_SELECTION_DURATION_MS,
						easing: Easing.out(Easing.cubic),
					}),
		);
	}, [isSelected, reducedMotion, selectionProgress]);

	const pillStyle = useAnimatedStyle(() => ({
		backgroundColor: interpolateColor(
			selectionProgress.get(),
			[0, 1],
			[colors.systemSubtle, colors.primary],
		),
		borderColor: interpolateColor(
			selectionProgress.get(),
			[0, 1],
			[colors.path1, colors.primary],
		),
		transform: [{ scale: pressedScale.get() }],
	}));
	const checkStyle = useAnimatedStyle(() => {
		const progress = selectionProgress.get();
		return {
			opacity: progress,
			transform: [{ scale: 0.72 + progress * 0.28 }],
		};
	});
	const labelStyle = useAnimatedStyle(() => ({
		color: interpolateColor(
			selectionProgress.get(),
			[0, 1],
			[colors.text, colors.onPrimary],
		),
	}));

	const setPressedScale = (scale: number, duration: number) => {
		if (reducedMotion) return;
		pressedScale.set(
			withTiming(scale, {
				duration,
				easing: Easing.out(Easing.cubic),
			}),
		);
	};

	return (
		<AnimatedPressable
			accessibilityRole="checkbox"
			accessibilityLabel={label}
			accessibilityState={{ checked: isSelected }}
			onPress={onToggle}
			onPressIn={() => setPressedScale(0.97, STUDY_DAY_PRESS_IN_DURATION_MS)}
			onPressOut={() => setPressedScale(1, STUDY_DAY_PRESS_OUT_DURATION_MS)}
			className="min-h-12 min-w-[100px] flex-row items-center justify-center rounded-full border px-3 py-3"
			// Runtime state and press feedback intentionally animate outside NativeWind.
			style={pillStyle}
		>
			<View
				testID={`study-day-pill-check-slot-${label}`}
				className="h-4 w-4 items-center justify-center"
			>
				<Animated.View style={checkStyle}>
					<Check size={16} color={colors.onPrimary} strokeWidth={2.4} />
				</Animated.View>
			</View>
			<Animated.Text
				className="ml-2 font-poppins font-semibold text-body-3"
				style={[
					Platform.select({ android: { includeFontPadding: false } }),
					labelStyle,
				]}
			>
				{label}
			</Animated.Text>
			<View
				testID={`study-day-pill-balance-slot-${label}`}
				className="ml-2 h-4 w-4"
			/>
		</AnimatedPressable>
	);
}

function StudyDaysAnswer() {
	const { answers, setAnswer } = useOnboarding();
	const selectedDays = new Set(parseOnboardingStudyDays(answers.studyDays));

	return (
		<View className="w-full flex-row flex-wrap justify-center gap-3 px-2">
			{LEARNING_DAYS.map((day) => (
				<AnimatedStudyDayPill
					key={day.value}
					label={day.label}
					isSelected={selectedDays.has(day.label)}
					onToggle={() =>
						setAnswer(
							"studyDays",
							toggleOnboardingStudyDay(
								answers.studyDays,
								day.label as LearningDayLabel,
							),
						)
					}
				/>
			))}
		</View>
	);
}

function LearningTimeAnswer() {
	const { answers, setAnswer } = useOnboarding();
	const { colors } = useDayovaTheme();
	const [pickerVisible, setPickerVisible] = useState(false);
	const [pendingTime, setPendingTime] = useState(() =>
		dateForOnboardingTime(answers.learningTime),
	);
	const openPicker = () => {
		setPendingTime(
			dateForOnboardingTime(
				answers.learningTime || getDefaultOnboardingLearningStartTime(),
			),
		);
		setPickerVisible(true);
	};
	const updateTime = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (event.type !== "set" || !selectedDate) return;
		setPendingTime(selectedDate);
	};
	const confirmTime = (selectedDate: Date) => {
		setAnswer("learningTime", formatOnboardingTime(selectedDate));
	};

	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={
					answers.learningTime
						? `Lernzeit beginnt um ${answers.learningTime} Uhr`
						: "Startzeit auswählen"
				}
				accessibilityHint="Öffnet die native Uhrzeitauswahl"
				onPress={openPicker}
				className="min-h-24 w-full max-w-[345px] flex-row items-center rounded-card border border-border bg-surface px-6 active:opacity-80"
				style={{ borderCurve: "continuous" }}
			>
				<View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<Clock3 size={24} color={colors.primary} strokeWidth={2} />
				</View>
				<View className="ml-4 flex-1">
					<Text className="font-poppins text-body-5 text-secondary-text">
						Start deiner Lernzeit
					</Text>
					<Text
						className={cn(
							"mt-1 font-poppins font-semibold text-heading-2",
							answers.learningTime ? "text-text" : "text-secondary-text",
						)}
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{answers.learningTime
							? `${answers.learningTime} Uhr`
							: "Uhrzeit auswählen"}
					</Text>
				</View>
			</Pressable>

			<DateTimePickerSheet
				visible={pickerVisible}
				value={pendingTime}
				mode="time"
				doneLabel="Zeit übernehmen"
				onChange={updateTime}
				onClose={() => setPickerVisible(false)}
				onConfirm={confirmTime}
			/>
		</>
	);
}

function PayoffAnswer() {
	const { answers } = useOnboarding();
	const { colors } = useDayovaTheme();
	const firstName = answers.name.trim().split(/\s+/)[0] || "Du";
	const schedule = getOnboardingLearningTimeSummary(answers);
	const summary = [
		{
			label: schedule.durationLabel,
			value: "Dauer pro Lerntag",
			icon: Clock3,
		},
		{
			label: schedule.daysLabel,
			value: "deine wiederkehrenden Lerntage",
			icon: CalendarDays,
		},
		{
			label: schedule.windowLabel,
			value: "dein Zeitfenster",
			icon: Clock3,
		},
	] as const;

	return (
		<View className="w-full items-center">
			<View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
				<CalendarDays size={30} color={colors.primary} strokeWidth={2} />
			</View>
			<Text
				accessibilityRole="header"
				className="mt-5 max-w-[350px] text-center font-poppins font-semibold text-heading-1 text-text"
			>
				{firstName}, deine Lernzeiten sind vorbereitet.
			</Text>
			<Text className="mt-3 max-w-[340px] text-center font-poppins text-body-3 text-secondary-text">
				Dayova speichert diese Zeitfenster nach der Registrierung und nutzt sie
				für die Planung deiner Lerntermine. In den Einstellungen kannst du sie
				später einzeln ändern.
			</Text>

			<View className="mt-7 w-full gap-3">
				{summary.map((item) => {
					const Icon = item.icon;
					return (
						<View
							key={item.value}
							className="min-h-18 flex-row items-center rounded-[24px] border border-border bg-surface px-5 py-3"
						>
							<View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
								<Icon size={19} color={colors.primary} strokeWidth={2} />
							</View>
							<View className="ml-4 flex-1">
								<Text className="font-poppins font-semibold text-body-3 text-text">
									{item.label}
								</Text>
								<Text className="font-poppins text-body-5 text-secondary-text">
									{item.value}
								</Text>
							</View>
							<Check size={20} color={colors.primary} strokeWidth={2.2} />
						</View>
					);
				})}
			</View>
		</View>
	);
}

function WheelAnswer({ step }: { step: WheelStep }) {
	const { answers, setAnswer } = useOnboarding();

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

	if (step.field === "birthYear") {
		return (
			<OnboardingSelect
				accessibilityLabel="Geburtsjahr auswählen"
				value={answers.birthYear}
				options={getBirthYearValues()}
				testID="onboarding-birth-year-picker"
				title="Geburtsjahr auswählen"
				onChange={(value) => {
					setAnswer("birthYear", value);
					setAnswer("birthMonth", "");
					setAnswer("birthDay", "");
				}}
			/>
		);
	}

	if (step.field === "birthMonth") {
		return (
			<OnboardingSelect
				accessibilityLabel="Geburtsmonat auswählen"
				value={answers.birthMonth}
				options={getBirthMonthValues(answers.birthYear)}
				formatLabel={(month) =>
					BIRTH_MONTH_OPTIONS.find((option) => option.value === month)?.label ??
					month
				}
				testID="onboarding-birth-month-picker"
				title="Geburtsmonat auswählen"
				onChange={(value) => {
					setAnswer("birthMonth", value);
					setAnswer("birthDay", "");
				}}
			/>
		);
	}

	if (step.field === "birthDay") {
		return (
			<OnboardingSelect
				accessibilityLabel="Geburtstag auswählen"
				value={answers.birthDay}
				options={getBirthDayValues(answers.birthYear, answers.birthMonth)}
				formatLabel={(day) => `${Number.parseInt(day, 10)}.`}
				testID="onboarding-birth-day-picker"
				title="Geburtstag auswählen"
				onChange={(value) => setAnswer("birthDay", value)}
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
	responsive = false,
	scale,
	tone,
}: {
	label: string;
	onPress: () => void;
	responsive?: boolean;
	scale: number;
	tone: "gradient" | "dark";
}) {
	const height = AUTH_CHOICE_FRAME.buttons.height * scale;
	const { fontScale } = useWindowDimensions();
	const responsiveLayout = getResponsiveAuthChoiceLayout(fontScale);
	const visibleLabel =
		responsive && label === "Registrierung" ? "Registrie­rung" : label;
	const [pressed, setPressed] = useState(false);

	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			onPress={onPress}
			onPressIn={() => setPressed(true)}
			onPressOut={() => setPressed(false)}
			style={{
				height: responsive ? undefined : height,
				minHeight: responsive ? responsiveLayout.buttonMinHeight : undefined,
				borderRadius: responsive
					? DAYOVA_DESIGN_SYSTEM.radius.button
					: height / 2,
				borderColor: tone === "gradient" ? COLORS.surface : COLORS.border,
				borderWidth: responsive
					? DAYOVA_DESIGN_SYSTEM.size.button.borderWidth
					: 0,
				overflow: "hidden",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: tone === "dark" ? COLORS.buttonNeutral : "transparent",
				paddingHorizontal: responsive ? 24 : 0,
				paddingVertical: responsive ? 12 : 0,
				opacity: pressed ? 0.78 : 1,
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
				allowFontScaling={responsive ? false : undefined}
				className={
					responsive
						? "text-center font-poppins font-semibold text-body-2"
						: "font-poppins font-semibold"
				}
				style={{
					color: COLORS.surface,
					fontSize: responsive ? responsiveLayout.bodyFontSize : 16 * scale,
					lineHeight: responsive ? responsiveLayout.bodyLineHeight : 24 * scale,
					includeFontPadding: false,
					width: responsive ? "100%" : undefined,
					textAlignVertical: "center",
				}}
			>
				{visibleLabel}
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
