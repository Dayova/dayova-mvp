import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
	type ComponentType,
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Easing,
	FadeIn,
	FadeInDown,
	FadeInUp,
	LinearTransition,
	SlideInRight,
	SlideOutLeft,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
	Circle,
	Defs,
	Ellipse,
	G,
	Line,
	Path,
	Rect,
	Stop,
	LinearGradient as SvgLinearGradient,
	Text as SvgText,
} from "react-native-svg";
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	Bulb,
	Calculator,
	CalendarDays,
	Chemistry,
	ClipboardEdit,
	ClipboardList,
	CloudUpload,
	Dna,
	Earth,
	Eye,
	EyeOff,
	Football,
	Language,
	PaintBrush,
	Route2,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { useOnboarding } from "~/context/OnboardingContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useBackIntent } from "~/lib/navigation";

const COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const PRIMARY_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const CODE_LENGTH = 6;
const OTP_CELL_KEYS = [
	"otp-cell-1",
	"otp-cell-2",
	"otp-cell-3",
	"otp-cell-4",
	"otp-cell-5",
	"otp-cell-6",
] as const;
const FLOWER_PETAL_KEYS = [
	"flower-petal-0",
	"flower-petal-1",
	"flower-petal-2",
	"flower-petal-3",
	"flower-petal-4",
	"flower-petal-5",
	"flower-petal-6",
	"flower-petal-7",
	"flower-petal-8",
	"flower-petal-9",
] as const;
const otpAutoComplete = Platform.select<TextInputProps["autoComplete"]>({
	android: "sms-otp",
	default: "one-time-code",
});

type IconComponent = ComponentType<{
	size?: number;
	color?: string;
	strokeWidth?: number;
}>;

type IntroStep = {
	kind: "intro";
	id: "intro-tasks" | "intro-upload" | "intro-path";
	title: string;
	illustration: "tasks" | "upload" | "path";
};

type RangeStep = {
	kind: "range";
	id: "studyTime" | "dailySchoolTime";
	title: string;
	field: "studyTime" | "dailySchoolTime";
	values: readonly number[];
};

type FactStep = {
	kind: "fact";
	id: string;
	title: string;
	body: string;
	autoAdvance?: boolean;
	cardIcon?: "bulb" | "calendar" | "route";
	disabledButton?: boolean;
};

type ChipsStep = {
	kind: "chips";
	id: "strength" | "challenge" | "studyDays";
	title: string;
	field: "strength" | "challenge" | "studyDays";
	options: readonly ChipOption[];
};

type GoalStep = {
	kind: "goals";
	id: "goal";
	title: string;
	field: "goal";
	options: readonly string[];
};

type InfoStackStep = {
	kind: "infoStack";
	id: "plan-fit";
	title: string;
};

type TextStep = {
	kind: "text";
	id: "name" | "schoolType" | "email" | "password";
	title: string;
	field: "name" | "schoolType" | "email" | "password";
	placeholder: string;
	secure?: boolean;
	keyboardType?: TextInputProps["keyboardType"];
	autoComplete?: TextInputProps["autoComplete"];
	textContentType?: TextInputProps["textContentType"];
};

type WheelStep = {
	kind: "wheel";
	id: "state" | "grade" | "birthDate" | "learningTime";
	title: string;
	field: "state" | "grade" | "birthDate" | "learningTime";
};

type OnboardingStep =
	| IntroStep
	| RangeStep
	| FactStep
	| ChipsStep
	| GoalStep
	| InfoStackStep
	| TextStep
	| WheelStep;

type ChipOption = {
	label: string;
	icon?: IconComponent;
};

const SUBJECT_OPTIONS = [
	{ label: "Mathe", icon: Calculator },
	{ label: "Geographie", icon: Earth },
	{ label: "Kunst", icon: PaintBrush },
	{ label: "Physik", icon: Route2 },
	{ label: "Sprachen", icon: Language },
	{ label: "Biologie", icon: Dna },
	{ label: "Astronomie", icon: Route2 },
	{ label: "Chemie", icon: Chemistry },
	{ label: "Deutsch", icon: BookOpen },
	{ label: "Politik", icon: ClipboardList },
	{ label: "Sport", icon: Football },
	{ label: "Geschichte", icon: ClipboardEdit },
] as const;

const CHALLENGE_OPTIONS = [
	{ label: "Mündlich erklären" },
	{ label: "Aufschieben" },
	{ label: "Rechnen" },
	{ label: "Schreiben" },
	{ label: "Konzentration" },
	{ label: "Motivation" },
	{ label: "Vokabeln" },
	{ label: "Ablenkung" },
	{ label: "Zeitmanagement" },
	{ label: "Prüfungsangst" },
	{ label: "Organisation" },
] as const;

const DAY_OPTIONS = [
	{ label: "Montag" },
	{ label: "Dienstag" },
	{ label: "Mittwoch" },
	{ label: "Donnerstag" },
	{ label: "Freitag" },
	{ label: "Samstag" },
	{ label: "Sonntag" },
] as const;

const GOAL_OPTIONS = [
	"Bessere Noten",
	"Weniger Aufschieben",
	"Prüfung sicher bestehen",
	"Lernlücke schließen",
	"Mehr Struktur im Lernen",
	"Dranbleiben",
	"Besser vorbereitet sein",
] as const;

// Persisted onboarding answers use these labels, so this list must contain every
// German federal state instead of only the few values visible in the Figma wheel.
const FEDERAL_STATES = [
	"Bremen",
	"Hamburg",
	"Baden-Württemberg",
	"Sachsen",
	"Sachsen-Anhalt",
	"Brandenburg",
	"Bayern",
	"Berlin",
	"Hessen",
	"Niedersachsen",
	"Nordrhein-Westfalen",
	"Rheinland-Pfalz",
	"Saarland",
	"Schleswig-Holstein",
	"Thüringen",
	"Mecklenburg-Vorpommern",
] as const;

const GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"] as const;
const HOUR_OPTIONS = ["13", "14", "15", "16", "17", "18", "19"] as const;
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) =>
	String(minute).padStart(2, "0"),
);

const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, index) =>
	String(index + 1).padStart(2, "0"),
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) =>
	String(index + 1).padStart(2, "0"),
);
const CURRENT_YEAR = new Date().getFullYear();
// Birth date is stored rather than age, so derive a broad school-age range
// instead of freezing the small placeholder window from the mockup.
const BIRTH_YEAR_OPTIONS = Array.from({ length: 15 }, (_, index) =>
	String(CURRENT_YEAR - 21 + index),
);
const DEFAULT_BIRTH_DAY = "09";
const DEFAULT_BIRTH_MONTH = "09";
const DEFAULT_BIRTH_YEAR = String(CURRENT_YEAR - 14);

function getDaysInMonth(month: string, year: string) {
	return new Date(Number(year), Number(month), 0).getDate();
}

function clampBirthDay(day: string, month: string, year: string) {
	const numericDay = Number(day);
	const maxDay = getDaysInMonth(month, year);
	const clampedDay = Math.min(Math.max(numericDay || 1, 1), maxDay);
	return String(clampedDay).padStart(2, "0");
}

const FLOW_STEPS: readonly OnboardingStep[] = [
	{
		kind: "intro",
		id: "intro-tasks",
		illustration: "tasks",
		title: "Schluss mit\nAufschieben. Dein\nLernplan wartet.",
	},
	{
		kind: "intro",
		id: "intro-upload",
		illustration: "upload",
		title: "Einfach Unterlagen\nhochladen und\nlernen.",
	},
	{
		kind: "intro",
		id: "intro-path",
		illustration: "path",
		title: "Dein Lernplan\nstartet jetzt.",
	},
	{
		kind: "range",
		id: "studyTime",
		title: "Wie viel lernst du\naktuell pro Tag?",
		field: "studyTime",
		values: [10, 20, 30, 45, 60],
	},
	{
		kind: "fact",
		id: "short-study-fact",
		title: "Du brauchst nicht\nstundenlang zu\nlernen.",
		body: "Deine 30 Minuten reichen aus, um eine starke Lernroutine aufzubauen. Studien zeigen: Kleine Lerneinheiten bleiben länger hängen als langes Pauken auf einmal.",
		cardIcon: "route",
	},
	{
		kind: "chips",
		id: "strength",
		title: "Wo liegen deine\nStärken?",
		field: "strength",
		options: SUBJECT_OPTIONS,
	},
	{
		kind: "chips",
		id: "challenge",
		title: "Was sind deine\ngrößten Baustellen\nin der Schule?",
		field: "challenge",
		options: CHALLENGE_OPTIONS,
	},
	{
		kind: "goals",
		id: "goal",
		title: "Was möchtest du\nmit uns erreichen?",
		field: "goal",
		options: GOAL_OPTIONS,
	},
	{
		kind: "infoStack",
		id: "plan-fit",
		title: "Dein Lernplan passt\nsich genau dir an.",
	},
	{
		kind: "text",
		id: "name",
		title: "Wie heißt du?",
		field: "name",
		placeholder: "Max Muster",
		autoComplete: "name",
		textContentType: "name",
	},
	{
		kind: "wheel",
		id: "state",
		title: "Aus welchem\nBundesland\nkommst du?",
		field: "state",
	},
	{
		kind: "text",
		id: "schoolType",
		title: "Welche Schule\nbesuchst du?",
		field: "schoolType",
		placeholder: "Gymnasium",
		autoComplete: "off",
	},
	{
		kind: "wheel",
		id: "grade",
		title: "Welche\nKlassenstufe\nbesuchst du?",
		field: "grade",
	},
	{
		kind: "wheel",
		id: "birthDate",
		title: "Wie alt bist du?",
		field: "birthDate",
	},
	{
		kind: "range",
		id: "dailySchoolTime",
		title: "Wie viel Zeit willst\ndu pro Tag für die\nSchule aufwenden?",
		field: "dailySchoolTime",
		values: [10, 20, 30, 45, 60],
	},
	{
		kind: "fact",
		id: "routine-fit",
		title: "Dein Lernplan passt\nsich deinem Alltag\nan.",
		body: "Wir erstellen für dich einen Lernplan, der sich an deinen Alltag und deinen Lernstand anpasst. Dayova berücksichtigt dabei deine Fortschritte und passt den Plan laufend an.",
		autoAdvance: true,
		cardIcon: "route",
		disabledButton: true,
	},
	{
		kind: "chips",
		id: "studyDays",
		title: "An welchen Tagen\nkannst du lernen?",
		field: "studyDays",
		options: DAY_OPTIONS,
	},
	{
		kind: "wheel",
		id: "learningTime",
		title: "Wann ist die beste\nUhrzeit für dich zum\nlernen?",
		field: "learningTime",
	},
	{
		kind: "fact",
		id: "later-adjust",
		title: "Keine Sorge, du\nkannst deine\nLernzeiten später\nanpassen.",
		body: "Heute steht eine Lerneinheit für deine Mathe Klassenarbeit an.",
		cardIcon: "calendar",
	},
	{
		kind: "text",
		id: "email",
		title: "Wie lautet deine\nE-Mail?",
		field: "email",
		placeholder: "max.muster",
		keyboardType: "email-address",
		autoComplete: "email",
		textContentType: "emailAddress",
	},
	{
		kind: "text",
		id: "password",
		title: "Lege dein Passwort\nfest",
		field: "password",
		placeholder: "••••••••",
		secure: true,
		autoComplete: "new-password",
		textContentType: "newPassword",
	},
] as const;

const QUESTION_STEP_COUNT = FLOW_STEPS.length + 2;

const isValidEmail = (value: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidPassword = (value: string) => value.trim().length >= 8;

const isValidName = (value: string) =>
	value.trim().length >= 2 && /^[A-Za-zÀ-ÿ' -]+$/.test(value.trim());

const toggleListValue = (current: string, label: string) => {
	const values = current
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	const exists = values.includes(label);
	const next = exists
		? values.filter((item) => item !== label)
		: [...values, label];
	return next.join(", ");
};

const hasListValue = (current: string, label: string) =>
	current
		.split(",")
		.map((item) => item.trim())
		.includes(label);

const defaultAnswerForStep = (step: OnboardingStep) => {
	if (step.kind === "range") return "30 min";
	if (step.kind === "wheel") {
		if (step.field === "state") return "Sachsen";
		if (step.field === "grade") return "9";
		if (step.field === "birthDate") return "09.09.2012";
		if (step.field === "learningTime") return "16:44";
	}
	return "";
};

export function AuthChoiceScreen() {
	const insets = useSafeAreaInsets();

	return (
		<View style={{ flex: 1, backgroundColor: COLORS.background }}>
			<Stack.Screen options={{ title: "Dayova" }} />
			<StatusBar style="dark" />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					flexGrow: 1,
					paddingTop: Math.max(insets.top + 16, 24),
					paddingBottom: Math.max(insets.bottom + 18, 26),
					paddingHorizontal: 24,
				}}
			>
				<View style={{ flex: 1, justifyContent: "center" }}>
					<Animated.View
						entering={FadeIn.duration(450)}
						style={{
							position: "absolute",
							left: -24,
							right: -24,
							top: -24,
							bottom: -24,
							overflow: "hidden",
						}}
					>
						<AuthBackgroundPattern />
					</Animated.View>

					<Animated.View
						entering={FadeInDown.duration(520).springify().damping(18)}
						style={{ alignItems: "center" }}
					>
						<View
							style={{
								width: 136,
								height: 136,
								borderRadius: 32,
								backgroundColor: COLORS.surface,
								alignItems: "center",
								justifyContent: "center",
								boxShadow: "0 18px 45px rgba(20, 28, 48, 0.06)",
							}}
						>
							<Image
								source={require("../../../assets/dayova-logo.png")}
								resizeMode="contain"
								style={{ width: 88, height: 88 }}
							/>
						</View>

						<Text
							className="mt-6 text-center font-bold font-poppins text-text"
							style={{ fontSize: 54, lineHeight: 66 }}
						>
							Dayova
						</Text>
						<Text className="mt-2 max-w-[260px] text-center font-poppins text-body-2 text-secondary-text">
							Du bist neu hier, dann Registriere dich. Andernfalls willkommen
							zurück
						</Text>
					</Animated.View>

					<Animated.View
						entering={FadeInUp.delay(120).duration(520).springify().damping(18)}
						style={{ marginTop: 42, gap: 12 }}
					>
						<GradientPillButton
							label="Registrierung"
							onPress={() => router.push("/onboarding")}
						/>
						<DarkPillButton
							label="Login"
							onPress={() => router.push("/login")}
						/>
					</Animated.View>

					<Text className="mt-4 text-center font-poppins text-black-30 text-body-5">
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

type RegistrationStage = "flow" | "verification" | "creating";

export function OnboardingScreen() {
	const insets = useSafeAreaInsets();
	const [activeIndex, setActiveIndex] = useState(0);
	const [stage, setStage] = useState<RegistrationStage>("flow");
	const [error, setError] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState("");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const {
		register,
		verifyEmailCode,
		resendVerification,
		isLoading,
		user,
		isConvexAuthenticated,
		isPostAuthSyncing,
	} = useAuth();
	const { answers, setAnswer, hasAnswers } = useOnboarding();
	const activeStep = FLOW_STEPS[activeIndex];
	const textInputRef = useRef<TextInput | null>(null);
	const verificationInputRef = useRef<TextInput | null>(null);
	const verificationSubmittedRef = useRef(false);

	useEffect(() => {
		const defaultValue = defaultAnswerForStep(activeStep);
		if (!defaultValue) return;
		if (!("field" in activeStep)) return;
		if (answers[activeStep.field]?.trim()) return;
		setAnswer(activeStep.field, defaultValue);
	}, [activeStep, answers, setAnswer]);

	useEffect(() => {
		if (
			activeStep.kind !== "fact" ||
			!activeStep.autoAdvance ||
			stage !== "flow"
		) {
			return;
		}

		const timeout = setTimeout(() => {
			setActiveIndex((current) => Math.min(current + 1, FLOW_STEPS.length - 1));
		}, 1850);

		return () => clearTimeout(timeout);
	}, [activeStep, stage]);

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
			router.replace("/home");
		});

		return () => cancelAnimationFrame(frame);
	}, [hasAnswers, isPostAuthSyncing, stage, user]);

	useEffect(() => {
		if (stage !== "creating") return;
		if (!user || !isConvexAuthenticated || hasAnswers || isPostAuthSyncing)
			return;

		const timeout = setTimeout(() => {
			router.replace("/home");
		}, 900);

		return () => clearTimeout(timeout);
	}, [hasAnswers, isConvexAuthenticated, isPostAuthSyncing, stage, user]);

	const handleBack = useCallback(() => {
		if (stage === "creating" || isLoading) return true;
		if (stage === "verification") {
			setStage("flow");
			setVerificationCode("");
			setError(null);
			verificationSubmittedRef.current = false;
			return true;
		}
		if (activeIndex === 0) {
			router.replace("/");
			return true;
		}
		Keyboard.dismiss();
		setError(null);
		setActiveIndex((current) => current - 1);
		return true;
	}, [activeIndex, isLoading, stage]);

	useBackIntent(true, handleBack);

	const stepProgress =
		stage === "verification" || stage === "creating"
			? (FLOW_STEPS.length + 1) / QUESTION_STEP_COUNT
			: (activeIndex + 1) / QUESTION_STEP_COUNT;

	const continueFromStep = async () => {
		if (stage !== "flow") return;
		setError(null);

		if (activeStep.kind === "text") {
			Keyboard.dismiss();
			const value = answers[activeStep.field].trim();
			if (activeStep.field === "name" && !isValidName(value)) {
				setError("Bitte gib deinen Namen ein.");
				return;
			}
			if (activeStep.field === "schoolType" && value.length < 2) {
				setError("Bitte gib deine Schulform ein.");
				return;
			}
			if (activeStep.field === "email" && !isValidEmail(value.toLowerCase())) {
				setError("Bitte gib eine gültige E-Mail-Adresse ein.");
				return;
			}
			if (activeStep.field === "password") {
				if (!isValidPassword(value)) {
					setError("Bitte gib ein Passwort mit mindestens 8 Zeichen ein.");
					return;
				}
				await startRegistration();
				return;
			}
		}

		if (
			activeStep.kind === "chips" ||
			activeStep.kind === "goals" ||
			activeStep.kind === "range" ||
			activeStep.kind === "wheel"
		) {
			const value = answers[activeStep.field].trim();
			if (!value) {
				setError("Bitte wähle eine Antwort aus.");
				return;
			}
		}

		if (activeIndex < FLOW_STEPS.length - 1) {
			setActiveIndex((current) => current + 1);
		}
	};

	const startRegistration = async () => {
		try {
			// The password step validates a trimmed value, so submit the same value
			// to avoid creating credentials different from what the UI accepted.
			const normalizedPassword = answers.password.trim();
			const result = await register({
				name: answers.name.trim(),
				email: answers.email.trim().toLowerCase(),
				password: normalizedPassword,
				birthDate: answers.birthDate,
				grade: answers.grade,
				schoolType: answers.schoolType,
				state: answers.state,
			});

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
		}
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
			<CreationLoaderScreen topInset={insets.top} bottomInset={insets.bottom} />
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
		<View style={{ flex: 1, backgroundColor: COLORS.background }}>
			<Stack.Screen
				options={{ title: "Registrierung", gestureEnabled: false }}
			/>
			<StatusBar style="dark" />
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={{ flex: 1 }}
			>
				<ScrollView
					key={activeStep.id}
					keyboardShouldPersistTaps="handled"
					contentInsetAdjustmentBehavior="automatic"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						flexGrow: 1,
						paddingTop: Math.max(insets.top + 12, 20),
						paddingBottom: Math.max(insets.bottom + 18, 26),
						paddingHorizontal: 24,
					}}
				>
					{isIntro ? (
						<IntroStepView
							step={activeStep}
							activeIndex={activeIndex}
							onNext={continueFromStep}
						/>
					) : (
						<QuestionStepView
							step={activeStep}
							progress={stepProgress}
							error={error}
							passwordVisible={passwordVisible}
							inputRef={textInputRef}
							onBack={handleBack}
							onContinue={continueFromStep}
							onTogglePassword={() => setPasswordVisible((current) => !current)}
						/>
					)}
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
}

function IntroStepView({
	step,
	activeIndex,
	onNext,
}: {
	step: IntroStep;
	activeIndex: number;
	onNext: () => void;
}) {
	const { height } = useWindowDimensions();
	const illustrationHeight = Math.min(330, Math.max(235, height * 0.36));

	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<Animated.View
				entering={SlideInRight.duration(420).springify().damping(19)}
				exiting={SlideOutLeft.duration(220)}
				style={{
					width: "100%",
					height: illustrationHeight,
					alignItems: "center",
					justifyContent: "center",
					marginTop: 20,
				}}
			>
				<IntroIllustration kind={step.illustration} />
			</Animated.View>

			<Animated.Text
				entering={FadeInUp.delay(80).duration(380).springify().damping(18)}
				style={{
					marginTop: 24,
					textAlign: "center",
					fontFamily: "Poppins",
					fontWeight: "700",
					fontSize: 28,
					lineHeight: 36,
					color: COLORS.text,
				}}
			>
				{step.title}
			</Animated.Text>

			<IntroDots activeIndex={activeIndex} />
			<CircularNextButton onPress={onNext} style={{ marginTop: 28 }} />
		</View>
	);
}

function QuestionStepView({
	step,
	progress,
	error,
	passwordVisible,
	inputRef,
	onBack,
	onContinue,
	onTogglePassword,
}: {
	step: Exclude<OnboardingStep, IntroStep>;
	progress: number;
	error: string | null;
	passwordVisible: boolean;
	inputRef: RefObject<TextInput | null>;
	onBack: () => boolean;
	onContinue: () => void;
	onTogglePassword: () => void;
}) {
	const { answers, setAnswer } = useOnboarding();
	const showBottomButton = step.kind !== "text";
	const buttonDisabled = step.kind === "fact" && step.disabledButton;

	return (
		<View style={{ flex: 1 }}>
			<AuthProgressHeader progress={progress} onBack={onBack} />

			<Animated.View
				entering={FadeInDown.duration(360).springify().damping(18)}
				layout={LinearTransition.duration(220)}
				style={{
					flex: 1,
					alignItems: "center",
					paddingTop: step.kind === "text" ? 50 : 36,
				}}
			>
				<Text
					className="text-center font-bold font-poppins text-text"
					style={{
						fontSize: step.kind === "range" ? 24 : 25,
						lineHeight: step.kind === "range" ? 30 : 32,
					}}
				>
					{step.title}
				</Text>

				<View
					style={{
						width: "100%",
						marginTop:
							step.kind === "goals" ? 28 : step.kind === "text" ? 22 : 30,
						alignItems: "center",
					}}
				>
					{step.kind === "range" ? (
						<RangeSelector
							value={answers[step.field] || "30 min"}
							values={step.values}
							accessibilityLabel={step.title.replace(/\n/g, " ")}
							onChange={(value) => setAnswer(step.field, value)}
						/>
					) : null}

					{step.kind === "fact" ? <FactPanel step={step} /> : null}

					{step.kind === "chips" ? (
						<ChipCloud
							options={step.options}
							value={answers[step.field]}
							onToggle={(label) =>
								setAnswer(
									step.field,
									toggleListValue(answers[step.field], label),
								)
							}
						/>
					) : null}

					{step.kind === "goals" ? (
						<GoalList
							options={step.options}
							value={answers.goal}
							onToggle={(label) =>
								setAnswer("goal", toggleListValue(answers.goal, label))
							}
						/>
					) : null}

					{step.kind === "infoStack" ? <PlanFitStack /> : null}

					{step.kind === "wheel" ? <WheelAnswer step={step} /> : null}

					{step.kind === "text" ? (
						<PillTextInput
							refObject={inputRef}
							value={answers[step.field]}
							placeholder={step.placeholder}
							secure={step.secure && !passwordVisible}
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
									<Pressable
										hitSlop={8}
										onPress={onTogglePassword}
										style={{
											width: 28,
											height: 28,
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										{passwordVisible ? (
											<EyeOff size={17} color={COLORS.secondaryText} />
										) : (
											<Eye size={17} color={COLORS.secondaryText} />
										)}
									</Pressable>
								) : null
							}
						/>
					) : null}
				</View>

				{error ? (
					<Animated.Text
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

			{showBottomButton ? (
				<View style={{ paddingTop: 22 }}>
					<DarkPillButton
						label="Weiter"
						onPress={onContinue}
						disabled={buttonDisabled}
					/>
				</View>
			) : null}
		</View>
	);
}

export function LoginScreen() {
	const insets = useSafeAreaInsets();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState("");
	const [verificationMode, setVerificationMode] = useState(false);
	const verificationInputRef = useRef<TextInput | null>(null);
	const submittedRef = useRef(false);
	const {
		login,
		verifyEmailCode,
		resendVerification,
		isLoading,
		pendingVerification,
	} = useAuth();

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
		const normalizedPassword = password.trim();
		if (!isValidEmail(email.trim().toLowerCase())) {
			setError("Bitte gib eine gültige E-Mail-Adresse ein.");
			return;
		}
		if (!normalizedPassword) {
			setError("Bitte gib dein Passwort ein.");
			return;
		}

		try {
			const result = await login({
				email: email.trim().toLowerCase(),
				password: normalizedPassword,
			});
			if (result.status === "complete") {
				router.replace("/home");
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
		}
	};

	const submitLoginCode = async (code: string) => {
		if (submittedRef.current) return;
		submittedRef.current = true;
		Keyboard.dismiss();
		setError(null);
		try {
			const result = await verifyEmailCode(code);
			if (result.status === "complete") {
				router.replace("/home");
			}
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

	return (
		<View style={{ flex: 1, backgroundColor: COLORS.background }}>
			<Stack.Screen options={{ title: "Login" }} />
			<StatusBar style="dark" />
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={{ flex: 1 }}
			>
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						flexGrow: 1,
						paddingTop: Math.max(insets.top + 52, 64),
						paddingBottom: Math.max(insets.bottom + 18, 28),
						paddingHorizontal: 34,
					}}
				>
					<View style={{ flex: 1, alignItems: "center" }}>
						<Animated.View
							entering={FadeInDown.duration(440).springify().damping(18)}
						>
							<Image
								source={require("../../../assets/dayova-logo.png")}
								resizeMode="contain"
								style={{ width: 88, height: 88 }}
							/>
						</Animated.View>

						<Text
							className="mt-8 text-center font-bold font-poppins text-text"
							style={{ fontSize: 32, lineHeight: 40 }}
						>
							Willkommen
						</Text>
						<Text className="mt-1 max-w-[260px] text-center font-poppins text-body-5 text-text">
							Freut uns dich wiederzusehen, melde dich{"\n"}an und starte
							direkt.
						</Text>

						<View style={{ width: "100%", marginTop: 28, gap: 12 }}>
							<FormPill
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
								value={password}
								placeholder="••••••••"
								secureTextEntry={!passwordVisible}
								autoCapitalize="none"
								autoComplete="current-password"
								textContentType="password"
								onChangeText={setPassword}
								onSubmitEditing={submitLogin}
								rightAccessory={
									<Pressable
										onPress={() => setPasswordVisible((current) => !current)}
									>
										{passwordVisible ? (
											<EyeOff size={18} color={COLORS.text} />
										) : (
											<Eye size={18} color={COLORS.text} />
										)}
									</Pressable>
								}
							/>
						</View>

						<View
							style={{
								width: "100%",
								marginTop: 12,
								alignItems: "center",
								justifyContent: "flex-end",
							}}
						>
							<Pressable onPress={() => setError("Passwort-Reset folgt bald.")}>
								<Text className="font-poppins text-body-5 text-primary">
									Passwort vergessen?
								</Text>
							</Pressable>
						</View>

						{error ? (
							<Animated.Text
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

						<View style={{ width: "100%", marginTop: 22 }}>
							<GradientPillButton
								label={isLoading ? "LOGIN..." : "LOGIN"}
								onPress={submitLogin}
								disabled={isLoading}
							/>
						</View>

						<View style={{ flex: 1 }} />
						<Text className="text-center font-poppins text-body-5 text-text">
							Du hast keinen Account?
						</Text>
						<Pressable onPress={() => router.replace("/onboarding")}>
							<Text className="text-center font-poppins text-body-5 text-primary">
								Register now
							</Text>
						</Pressable>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
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
		<View style={{ flex: 1, backgroundColor: COLORS.background }}>
			<Stack.Screen
				options={{ title: "E-Mail bestätigen", gestureEnabled: false }}
			/>
			<StatusBar style="dark" />
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={{ flex: 1 }}
			>
				<ScrollView
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={{
						flexGrow: 1,
						paddingTop: Math.max(topInset + 12, 20),
						paddingBottom: Math.max(bottomInset + 12, 20),
						paddingHorizontal: 24,
					}}
				>
					<AuthProgressHeader progress={progress} onBack={onBack} />
					<View style={{ flex: 1, alignItems: "center", paddingTop: 38 }}>
						<Text
							className="text-center font-bold font-poppins text-text"
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
						<Pressable disabled={disabled} onPress={() => void onResend()}>
							<Text className="text-center font-poppins font-semibold text-body-5 text-primary">
								Erneut senden
							</Text>
						</Pressable>

						{error ? (
							<Animated.Text
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

function CreationLoaderScreen({
	topInset,
	bottomInset,
}: {
	topInset: number;
	bottomInset: number;
}) {
	return (
		<View style={{ flex: 1, backgroundColor: COLORS.background }}>
			<Stack.Screen options={{ title: "Lernprofil", gestureEnabled: false }} />
			<StatusBar style="dark" />
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
				<AnimatedFlower />
				<Text
					className="mt-10 text-center font-bold font-poppins text-text"
					style={{ fontSize: 20, lineHeight: 29 }}
				>
					Dein persönliches Lernprofil{"\n"}wird nun für dich erstellt.
				</Text>
			</View>
		</View>
	);
}

function AuthProgressHeader({
	progress,
	onBack,
}: {
	progress: number;
	onBack: () => boolean;
}) {
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Zurück"
				onPress={() => onBack()}
				style={{
					width: 40,
					height: 40,
					borderRadius: 20,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: COLORS.surface,
					borderWidth: 1,
					borderColor: "rgba(17, 24, 39, 0.06)",
				}}
			>
				<ArrowLeft size={18} color={COLORS.text} strokeWidth={2.2} />
			</Pressable>
			<View
				style={{
					flex: 1,
					height: 5,
					borderRadius: 999,
					overflow: "hidden",
					backgroundColor: "rgba(0, 186, 255, 0.16)",
				}}
			>
				<Animated.View
					layout={LinearTransition.duration(280)}
					style={{
						height: "100%",
						width: `${Math.max(7, Math.min(progress, 1) * 100)}%`,
						borderRadius: 999,
						backgroundColor: COLORS.primary,
					}}
				/>
			</View>
		</View>
	);
}

function PillTextInput({
	refObject,
	value,
	placeholder,
	secure,
	keyboardType,
	autoComplete,
	textContentType,
	autoCapitalize,
	accessory,
	onChangeText,
	onSubmit,
}: {
	refObject: RefObject<TextInput | null>;
	value: string;
	placeholder: string;
	secure?: boolean;
	keyboardType?: TextInputProps["keyboardType"];
	autoComplete?: TextInputProps["autoComplete"];
	textContentType?: TextInputProps["textContentType"];
	autoCapitalize?: TextInputProps["autoCapitalize"];
	accessory?: ReactNode;
	onChangeText: (value: string) => void;
	onSubmit: () => void;
}) {
	return (
		<View
			style={{
				width: "100%",
				minHeight: 40,
				borderRadius: 24,
				borderWidth: 1.4,
				borderColor: COLORS.primary,
				backgroundColor: COLORS.surface,
				flexDirection: "row",
				alignItems: "center",
				paddingLeft: 16,
				paddingRight: 4,
			}}
		>
			<TextInput
				ref={refObject}
				value={value}
				placeholder={placeholder}
				placeholderTextColor="rgba(26, 26, 26, 0.42)"
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
					height: 38,
					fontFamily: "Poppins",
					fontSize: 13,
					color: COLORS.text,
					padding: 0,
					includeFontPadding: false,
				}}
			/>
			{accessory}
			<SmallArrowButton onPress={onSubmit} />
		</View>
	);
}

function FormPill({
	rightAccessory,
	...props
}: TextInputProps & { rightAccessory?: ReactNode }) {
	return (
		<View
			style={{
				height: 40,
				borderRadius: 22,
				backgroundColor: COLORS.surface,
				borderWidth: 1,
				borderColor: COLORS.primary,
				flexDirection: "row",
				alignItems: "center",
				paddingHorizontal: 16,
			}}
		>
			<TextInput
				placeholderTextColor="rgba(26, 26, 26, 0.45)"
				selectionColor={COLORS.primary}
				autoCorrect={false}
				style={{
					flex: 1,
					fontFamily: "Poppins",
					fontSize: 12,
					color: COLORS.text,
					padding: 0,
					includeFontPadding: false,
				}}
				{...props}
			/>
			{rightAccessory ? (
				<View style={{ marginLeft: 8 }}>{rightAccessory}</View>
			) : null}
		</View>
	);
}

function SmallArrowButton({ onPress }: { onPress: () => void }) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Weiter"
			onPress={onPress}
			style={{
				width: 32,
				height: 32,
				borderRadius: 16,
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
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
			<ArrowRight size={16} color="#FFFFFF" strokeWidth={2.3} />
		</Pressable>
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
	return (
		<Pressable onPress={() => inputRef.current?.focus()}>
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
								className="text-center font-bold font-poppins text-text"
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
				value={value}
				onChangeText={onChangeText}
				editable={!disabled}
				keyboardType="number-pad"
				textContentType="oneTimeCode"
				autoComplete={otpAutoComplete}
				autoCorrect={false}
				autoCapitalize="none"
				caretHidden
				maxLength={CODE_LENGTH}
				selectionColor="transparent"
				style={{ position: "absolute", opacity: 0.01, width: 1, height: 1 }}
			/>
		</Pressable>
	);
}

function RangeSelector({
	value,
	values,
	accessibilityLabel,
	onChange,
}: {
	value: string;
	values: readonly number[];
	accessibilityLabel: string;
	onChange: (value: string) => void;
}) {
	const parsedValue = Number.parseInt(value, 10);
	const fallbackValue = values.includes(30) ? 30 : (values[0] ?? 0);
	const selected = values.includes(parsedValue) ? parsedValue : fallbackValue;
	const selectedIndex = Math.max(0, values.indexOf(selected));
	const trackWidth = useSharedValue(1);
	const liveSelectedIndex = useSharedValue(selectedIndex);
	const lastIndex = Math.max(values.length - 1, 0);
	const selectIndex = useCallback(
		(nextIndex: number) => {
			const clampedIndex = Math.min(Math.max(nextIndex, 0), lastIndex);
			const nextValue = values[clampedIndex];
			if (nextValue === undefined) return;
			onChange(`${nextValue} min`);
		},
		[lastIndex, onChange, values],
	);

	useEffect(() => {
		liveSelectedIndex.set(selectedIndex);
	}, [liveSelectedIndex, selectedIndex]);

	const updateFromTrackX = (x: number) => {
		"worklet";
		const width = Math.max(trackWidth.get(), 1);
		const ratio = Math.min(Math.max(x / width, 0), 1);
		const nextIndex = Math.round(ratio * lastIndex);
		if (nextIndex === liveSelectedIndex.get()) return;
		liveSelectedIndex.set(nextIndex);
		scheduleOnRN(selectIndex, nextIndex);
	};

	const panGesture = Gesture.Pan()
		.activeOffsetX([-5, 5])
		.failOffsetY([-22, 22])
		.onBegin((event) => {
			"worklet";
			updateFromTrackX(event.x);
		})
		.onUpdate((event) => {
			"worklet";
			updateFromTrackX(event.x);
		});

	const tapGesture = Gesture.Tap().onEnd((event) => {
		"worklet";
		updateFromTrackX(event.x);
	});

	const sliderGesture = Gesture.Simultaneous(panGesture, tapGesture);
	const handleAccessibilityAction = ({
		nativeEvent,
	}: {
		nativeEvent: { actionName: string };
	}) => {
		if (nativeEvent.actionName === "increment") {
			selectIndex(selectedIndex + 1);
		}
		if (nativeEvent.actionName === "decrement") {
			selectIndex(selectedIndex - 1);
		}
	};

	return (
		<View style={{ alignItems: "center", width: "100%" }}>
			<View
				style={{
					width: 88,
					height: 88,
					borderRadius: 44,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 4,
					borderColor: "rgba(0, 186, 255, 0.18)",
				}}
			>
				<Svg width={88} height={88} style={{ position: "absolute" }}>
					<Circle
						cx="44"
						cy="44"
						r="40"
						fill="transparent"
						stroke={COLORS.primary}
						strokeWidth="4"
						strokeLinecap="round"
						strokeDasharray={`${Math.max(40, selected * 3.5)} 260`}
						transform="rotate(-90 44 44)"
					/>
				</Svg>
				<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
					{selected}
				</Text>
				<Text className="-mt-1 text-center font-poppins font-semibold text-body-5 text-text">
					min
				</Text>
			</View>

			<GestureDetector gesture={sliderGesture}>
				<View
					accessibilityRole="adjustable"
					accessibilityLabel={accessibilityLabel}
					accessibilityValue={{ text: `${selected} Minuten` }}
					accessibilityActions={[
						{ name: "increment", label: "Mehr Zeit" },
						{ name: "decrement", label: "Weniger Zeit" },
					]}
					onAccessibilityAction={handleAccessibilityAction}
					onLayout={(event) => {
						trackWidth.set(event.nativeEvent.layout.width);
					}}
					style={{
						marginTop: 56,
						width: "86%",
						height: 72,
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					{values.map((minutes) => {
						const active = minutes === selected;
						return (
							<Animated.View
								key={minutes}
								layout={LinearTransition.duration(180)}
								style={{
									width: active ? 6 : 3,
									height: active ? 66 : 28,
									borderRadius: 999,
									backgroundColor: active ? COLORS.primary : COLORS.border,
								}}
							/>
						);
					})}
				</View>
			</GestureDetector>
		</View>
	);
}

function ChipCloud({
	options,
	value,
	onToggle,
}: {
	options: readonly ChipOption[];
	value: string;
	onToggle: (label: string) => void;
}) {
	return (
		<View
			style={{
				width: "100%",
				flexDirection: "row",
				flexWrap: "wrap",
				justifyContent: "center",
				gap: 10,
			}}
		>
			{options.map((option, index) => {
				const selected = hasListValue(value, option.label);
				const Icon = option.icon;
				return (
					<Animated.View
						key={option.label}
						entering={FadeInDown.delay(index * 22).duration(220)}
						layout={LinearTransition.duration(180)}
					>
						<Pressable
							onPress={() => onToggle(option.label)}
							style={{
								minHeight: 32,
								borderRadius: 18,
								paddingHorizontal: 13,
								flexDirection: "row",
								alignItems: "center",
								gap: 5,
								backgroundColor: selected ? COLORS.primary : COLORS.surface,
								boxShadow: selected
									? "0 8px 18px rgba(0, 186, 255, 0.16)"
									: "0 4px 12px rgba(20, 28, 48, 0.04)",
							}}
						>
							{Icon ? (
								<Icon
									size={14}
									color={selected ? "#FFFFFF" : COLORS.primary}
									strokeWidth={2}
								/>
							) : null}
							<Text
								className="font-poppins text-body-5"
								style={{ color: selected ? "#FFFFFF" : COLORS.text }}
							>
								{option.label}
							</Text>
						</Pressable>
					</Animated.View>
				);
			})}
		</View>
	);
}

function GoalList({
	options,
	value,
	onToggle,
}: {
	options: readonly string[];
	value: string;
	onToggle: (label: string) => void;
}) {
	return (
		<View style={{ width: "100%", gap: 10 }}>
			{options.map((option, index) => {
				const selected = hasListValue(value, option);
				return (
					<Animated.View
						key={option}
						entering={FadeInDown.delay(index * 25).duration(240)}
						layout={LinearTransition.duration(180)}
					>
						<Pressable
							onPress={() => onToggle(option)}
							style={{
								minHeight: 42,
								borderRadius: 22,
								backgroundColor: selected ? COLORS.primary : COLORS.surface,
								flexDirection: "row",
								alignItems: "center",
								paddingHorizontal: 16,
								gap: 10,
							}}
						>
							<View
								style={{
									width: 16,
									height: 16,
									borderRadius: 8,
									borderWidth: 1.5,
									borderColor: selected ? "#FFFFFF" : COLORS.text,
									backgroundColor: selected
										? "rgba(255,255,255,0.28)"
										: "transparent",
								}}
							/>
							<Text
								className="font-poppins text-body-3"
								style={{ color: selected ? "#FFFFFF" : COLORS.text }}
							>
								{option}
							</Text>
						</Pressable>
					</Animated.View>
				);
			})}
		</View>
	);
}

function FactPanel({ step }: { step: FactStep }) {
	const Icon =
		step.cardIcon === "calendar"
			? CalendarDays
			: step.cardIcon === "bulb"
				? Bulb
				: Route2;

	return (
		<View style={{ width: "100%", minHeight: 260, alignItems: "center" }}>
			<View
				style={{
					position: "absolute",
					top: -8,
					width: 8,
					height: 150,
					borderRadius: 999,
					backgroundColor: "#E5EAF0",
					left: "25%",
				}}
			/>
			<View
				style={{
					position: "absolute",
					top: -8,
					width: 8,
					height: 150,
					borderRadius: 999,
					backgroundColor: "#E5EAF0",
					right: "25%",
				}}
			/>
			<Animated.View
				entering={FadeInUp.delay(80).duration(420).springify().damping(18)}
				style={{
					marginTop: 132,
					width: "88%",
					borderRadius: 20,
					backgroundColor: COLORS.surface,
					padding: 18,
					boxShadow: "0 16px 28px rgba(20, 28, 48, 0.05)",
				}}
			>
				<View
					style={{
						alignSelf: "flex-start",
						borderRadius: 999,
						backgroundColor: "rgba(0, 186, 255, 0.1)",
						paddingHorizontal: 9,
						paddingVertical: 5,
						flexDirection: "row",
						alignItems: "center",
						gap: 4,
					}}
				>
					<Icon size={13} color={COLORS.primary} strokeWidth={2} />
					<Text className="font-poppins font-semibold text-body-5 text-primary">
						Lernfakt
					</Text>
				</View>
				<Text className="mt-4 font-poppins text-body-5 text-secondary-text">
					{step.body}
				</Text>
			</Animated.View>
		</View>
	);
}

function PlanFitStack() {
	const items = [
		{
			icon: BookOpen,
			text: "Lerninhalte, die genau zu deinen Schwächen passen.",
		},
		{
			icon: Route2,
			text: "Aufgaben mit direktem Feedback nach jeder Antwort.",
		},
		{
			icon: ClipboardEdit,
			text: "Prüfungsmodus mit Zeitdruck und anschließender Auswertung.",
		},
	] as const;

	return (
		<View style={{ width: "100%", minHeight: 300, alignItems: "center" }}>
			<View
				style={{
					width: "78%",
					height: 260,
					borderRadius: 40,
					backgroundColor: "rgba(243, 246, 250, 0.65)",
					borderWidth: 1,
					borderColor: "rgba(220, 230, 238, 0.58)",
				}}
			/>
			<View style={{ position: "absolute", top: 44, width: "100%", gap: 16 }}>
				{items.map((item, index) => {
					const Icon = item.icon;
					return (
						<Animated.View
							key={item.text}
							entering={FadeInDown.delay(index * 80)
								.duration(360)
								.springify()
								.damping(18)}
							style={{
								minHeight: 58,
								borderRadius: 14,
								backgroundColor: COLORS.surface,
								paddingHorizontal: 16,
								flexDirection: "row",
								alignItems: "center",
								gap: 14,
								boxShadow: "0 12px 22px rgba(20, 28, 48, 0.05)",
							}}
						>
							<View
								style={{
									width: 36,
									height: 36,
									borderRadius: 18,
									backgroundColor: "rgba(0, 186, 255, 0.08)",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Icon size={18} color={COLORS.primary} strokeWidth={2} />
							</View>
							<Text className="flex-1 font-poppins text-body-4 text-text">
								{item.text}
							</Text>
						</Animated.View>
					);
				})}
			</View>
		</View>
	);
}

function WheelAnswer({ step }: { step: WheelStep }) {
	const { answers, setAnswer } = useOnboarding();

	if (step.field === "birthDate") {
		return (
			<BirthDateWheel
				value={
					answers.birthDate ||
					`${DEFAULT_BIRTH_DAY}.${DEFAULT_BIRTH_MONTH}.${DEFAULT_BIRTH_YEAR}`
				}
				onChange={(value) => setAnswer("birthDate", value)}
			/>
		);
	}

	if (step.field === "learningTime") {
		const [hour = "16", minute = "44"] = (
			answers.learningTime || "16:44"
		).split(":");
		return (
			<View style={{ width: "100%", alignItems: "center" }}>
				<View
					style={{
						flexDirection: "row",
						width: "70%",
						justifyContent: "center",
					}}
				>
					<WheelColumn
						options={HOUR_OPTIONS}
						value={hour}
						onChange={(nextHour) =>
							setAnswer("learningTime", `${nextHour}:${minute}`)
						}
						width={64}
					/>
					<WheelColumn
						options={MINUTE_OPTIONS}
						value={minute}
						onChange={(nextMinute) =>
							setAnswer("learningTime", `${hour}:${nextMinute}`)
						}
						width={64}
					/>
				</View>
			</View>
		);
	}

	const options = step.field === "state" ? FEDERAL_STATES : GRADE_OPTIONS;
	const defaultValue = step.field === "state" ? "Sachsen" : "9";
	const field = step.field;
	return (
		<View style={{ width: "100%", alignItems: "center" }}>
			<WheelColumn
				options={options}
				value={answers[field] || defaultValue}
				onChange={(value) => setAnswer(field, value)}
				width={step.field === "state" ? 260 : 120}
			/>
		</View>
	);
}

function BirthDateWheel({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [
		rawDay = DEFAULT_BIRTH_DAY,
		rawMonth = DEFAULT_BIRTH_MONTH,
		rawYear = DEFAULT_BIRTH_YEAR,
	] = value.split(".");
	const month = MONTH_OPTIONS.includes(rawMonth)
		? rawMonth
		: DEFAULT_BIRTH_MONTH;
	const year = BIRTH_YEAR_OPTIONS.includes(rawYear)
		? rawYear
		: DEFAULT_BIRTH_YEAR;
	const days = DAY_OF_MONTH_OPTIONS.slice(0, getDaysInMonth(month, year));
	const day = days.includes(rawDay)
		? rawDay
		: clampBirthDay(rawDay, month, year);
	const emitDate = (nextDay: string, nextMonth: string, nextYear: string) => {
		onChange(
			`${clampBirthDay(nextDay, nextMonth, nextYear)}.${nextMonth}.${nextYear}`,
		);
	};

	return (
		<View style={{ width: "100%", alignItems: "center" }}>
			<View style={{ flexDirection: "row", justifyContent: "center" }}>
				<WheelColumn
					options={days}
					value={day}
					onChange={(nextDay) => emitDate(nextDay, month, year)}
					width={70}
				/>
				<WheelColumn
					options={MONTH_OPTIONS}
					value={month}
					onChange={(nextMonth) => emitDate(day, nextMonth, year)}
					width={70}
				/>
				<WheelColumn
					options={BIRTH_YEAR_OPTIONS}
					value={year}
					onChange={(nextYear) => emitDate(day, month, nextYear)}
					width={88}
				/>
			</View>
		</View>
	);
}

function WheelColumn<TValue extends string>({
	options,
	value,
	onChange,
	width,
}: {
	options: readonly TValue[];
	value: TValue | string;
	onChange: (value: TValue) => void;
	width: number;
}) {
	const rowHeight = 22;
	const selectedIndex = Math.max(
		0,
		options.indexOf(value as TValue),
	);
	const lastIndex = Math.max(options.length - 1, 0);
	const liveSelectedIndex = useSharedValue(selectedIndex);
	const dragStartIndex = useSharedValue(selectedIndex);
	const selectIndex = useCallback(
		(nextIndex: number) => {
			const clampedIndex = Math.min(Math.max(nextIndex, 0), lastIndex);
			const nextValue = options[clampedIndex];
			if (nextValue === undefined) return;
			onChange(nextValue);
		},
		[lastIndex, onChange, options],
	);

	useEffect(() => {
		liveSelectedIndex.set(selectedIndex);
		dragStartIndex.set(selectedIndex);
	}, [dragStartIndex, liveSelectedIndex, selectedIndex]);

	const panGesture = Gesture.Pan()
		.activeOffsetY([-5, 5])
		.failOffsetX([-24, 24])
		.onBegin(() => {
			"worklet";
			dragStartIndex.set(liveSelectedIndex.get());
		})
		.onUpdate((event) => {
			"worklet";
			const nextIndex = Math.min(
				Math.max(
					Math.round(dragStartIndex.get() - event.translationY / rowHeight),
					0,
				),
				lastIndex,
			);
			if (nextIndex === liveSelectedIndex.get()) return;
			liveSelectedIndex.set(nextIndex);
			scheduleOnRN(selectIndex, nextIndex);
		});
	const visible = [-3, -2, -1, 0, 1, 2, 3]
		.map((offset) => {
			const option = options[selectedIndex + offset];
			return option ? { option, offset } : null;
		})
		.filter((item): item is { option: TValue; offset: number } =>
			Boolean(item),
		);

	return (
		<GestureDetector gesture={panGesture}>
			<View
				accessibilityRole="adjustable"
				accessibilityLabel="Auswahl"
				accessibilityValue={{ text: String(value) }}
				accessibilityActions={[
					{ name: "increment", label: "Naechster Wert" },
					{ name: "decrement", label: "Vorheriger Wert" },
				]}
				onAccessibilityAction={({ nativeEvent }) => {
					if (nativeEvent.actionName === "increment") {
						selectIndex(selectedIndex + 1);
					}
					if (nativeEvent.actionName === "decrement") {
						selectIndex(selectedIndex - 1);
					}
				}}
				style={{
					width,
					height: 144,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						left: -2,
						right: -2,
						top: 57,
						height: 30,
						borderRadius: 18,
						backgroundColor: COLORS.primary,
					}}
				/>
				{visible.map(({ option, offset }) => {
					const active = offset === 0;
					return (
						<Pressable
							key={option}
							onPress={() => onChange(option)}
							style={{
								position: "absolute",
								top: 57 + offset * rowHeight,
								width,
								height: 30,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Text
								className="text-center font-poppins"
								style={{
									fontSize: active ? 18 : 13,
									lineHeight: active ? 26 : 19,
									fontWeight: active ? "600" : "400",
									color: active ? "#FFFFFF" : "rgba(26, 26, 26, 0.22)",
									letterSpacing: active ? 4 : 0,
								}}
							>
								{option}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</GestureDetector>
	);
}

function IntroDots({ activeIndex }: { activeIndex: number }) {
	return (
		<View
			style={{
				marginTop: 28,
				flexDirection: "row",
				alignItems: "center",
				gap: 7,
			}}
		>
			{[0, 1, 2].map((index) => (
				<Animated.View
					key={index}
					layout={LinearTransition.duration(180)}
					style={{
						width: index === activeIndex ? 30 : 8,
						height: 6,
						borderRadius: 999,
						backgroundColor:
							index === activeIndex ? COLORS.text : "rgba(26, 26, 26, 0.35)",
					}}
				/>
			))}
		</View>
	);
}

function CircularNextButton({
	onPress,
	disabled,
	style,
}: {
	onPress: () => void;
	disabled?: boolean;
	style?: object;
}) {
	const rotation = useSharedValue(0);

	useEffect(() => {
		rotation.value = withRepeat(
			withTiming(360, { duration: 2200, easing: Easing.linear }),
			-1,
			false,
		);
	}, [rotation]);

	const ringStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	return (
		<View
			style={[
				{
					width: 76,
					height: 76,
					alignItems: "center",
					justifyContent: "center",
				},
				style,
			]}
		>
			<Animated.View
				style={[{ position: "absolute", width: 76, height: 76 }, ringStyle]}
			>
				<Svg width={76} height={76}>
					<Circle
						cx="38"
						cy="38"
						r="34"
						fill="transparent"
						stroke={disabled ? "rgba(26,26,26,0.18)" : COLORS.primary}
						strokeWidth="4"
						strokeLinecap="round"
						strokeDasharray="86 150"
					/>
				</Svg>
			</Animated.View>
			<Pressable
				disabled={disabled}
				onPress={onPress}
				style={{
					width: 60,
					height: 60,
					borderRadius: 30,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: disabled ? "rgba(26,26,26,0.32)" : "#1A1A1A",
				}}
			>
				<ArrowRight size={22} color="#FFFFFF" strokeWidth={2.4} />
			</Pressable>
		</View>
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
			<Text className="font-bold font-poppins text-body-2 text-white">
				{label}
			</Text>
		</Pressable>
	);
}

function DarkPillButton({
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
			disabled={disabled}
			onPress={onPress}
			style={{
				height: 56,
				borderRadius: 28,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: disabled ? "rgba(26,26,26,0.38)" : COLORS.text,
				boxShadow: disabled ? "none" : "0 8px 18px rgba(20, 28, 48, 0.08)",
			}}
		>
			<Text className="font-bold font-poppins text-body-2 text-white">
				{label}
			</Text>
		</Pressable>
	);
}

function AuthBackgroundPattern() {
	const items = [
		{ key: "paint-top", x: -18, y: 28, icon: PaintBrush },
		{ key: "earth-top", x: 118, y: 44, icon: Earth },
		{ key: "route-top", x: 272, y: 26, icon: Route2 },
		{ key: "dna-mid", x: -18, y: 196, icon: Dna },
		{ key: "clipboard-mid", x: 278, y: 188, icon: ClipboardEdit },
		{ key: "route-bottom", x: -18, y: 360, icon: Route2 },
		{ key: "calculator-bottom", x: 282, y: 350, icon: Calculator },
	] as const;

	return (
		<View style={{ flex: 1 }}>
			{items.map((item) => {
				const Icon = item.icon;
				return (
					<View
						key={item.key}
						style={{
							position: "absolute",
							left: item.x,
							top: item.y,
							width: 132,
							height: 132,
							borderRadius: 28,
							backgroundColor: "rgba(26,26,26,0.04)",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon size={56} color="rgba(26,26,26,0.14)" strokeWidth={1.8} />
					</View>
				);
			})}
		</View>
	);
}

function IntroIllustration({ kind }: { kind: IntroStep["illustration"] }) {
	if (kind === "upload") return <UploadIllustration />;
	if (kind === "path") return <PathIllustration />;
	return <TaskIllustration />;
}

function TaskIllustration() {
	return (
		<View
			style={{
				width: 300,
				height: 230,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Svg width={300} height={230} viewBox="0 0 300 230">
				<Defs>
					<SvgLinearGradient id="blueCard" x1="0" y1="0" x2="1" y2="1">
						<Stop offset="0" stopColor="#00A0E6" />
						<Stop offset="1" stopColor="#4FD8FF" />
					</SvgLinearGradient>
				</Defs>
				<G transform="translate(22 48) rotate(-11 90 50)">
					<Rect
						x="0"
						y="0"
						width="158"
						height="92"
						rx="13"
						fill="url(#blueCard)"
					/>
					<Rect x="0" y="24" width="158" height="68" rx="10" fill="#FFFFFF" />
					<SvgText x="20" y="17" fill="#FFFFFF" fontSize="10" fontWeight="700">
						Deine Aufgaben
					</SvgText>
					{[0, 1, 2].map((item) => (
						<G key={item} transform={`translate(18 ${40 + item * 18})`}>
							<Circle
								cx="5"
								cy="0"
								r="4"
								fill="transparent"
								stroke="#00BAFF"
								strokeWidth="1.5"
							/>
							<Line
								x1="18"
								y1="0"
								x2="128"
								y2="0"
								stroke="#DCE6EE"
								strokeWidth="1.5"
							/>
						</G>
					))}
				</G>
				<G transform="translate(166 45) rotate(8 70 52)">
					<Rect
						x="0"
						y="0"
						width="128"
						height="92"
						rx="16"
						fill="url(#blueCard)"
					/>
					<SvgText x="58" y="24" fill="#FFFFFF" fontSize="20" fontWeight="700">
						4
					</SvgText>
					<SvgText x="47" y="38" fill="#FFFFFF" fontSize="7" fontWeight="600">
						Erfolgreiche Lerntage
					</SvgText>
					{[0, 1, 2, 3, 4, 5].map((item) => (
						<Circle
							key={item}
							cx={20 + item * 18}
							cy="58"
							r="7"
							fill={item < 4 ? "#FFFFFF" : "rgba(255,255,255,0.28)"}
						/>
					))}
				</G>
				<G transform="translate(74 126)">
					<Rect width="190" height="64" rx="15" fill="#FFFFFF" />
					<Circle cx="34" cy="32" r="22" fill="#F6F8FB" />
					<Path
						d="M28 24 Q37 48 45 24"
						stroke="#00BAFF"
						strokeWidth="6"
						strokeLinecap="round"
						fill="none"
					/>
					<Line x1="68" y1="18" x2="68" y2="47" stroke="#DCE6EE" />
					<SvgText x="84" y="29" fill="#00BAFF" fontSize="13" fontWeight="700">
						Mathe lernen
					</SvgText>
					<SvgText x="84" y="49" fill="#1A1A1A" fontSize="11">
						Deine Lernstunde startet in 60
					</SvgText>
				</G>
			</Svg>
		</View>
	);
}

function UploadIllustration() {
	return (
		<View
			style={{
				width: 284,
				height: 230,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<View
				style={{
					width: 252,
					height: 170,
					borderRadius: 24,
					backgroundColor: COLORS.surface,
					alignItems: "center",
					paddingTop: 18,
				}}
			>
				<Text className="font-bold font-poppins text-body-2 text-text">
					Hochladen
				</Text>
				<Text className="font-poppins text-body-5 text-secondary-text">
					Lade deine Mitschriften hoch
				</Text>
				<View
					style={{
						marginTop: 16,
						width: 226,
						height: 104,
						borderRadius: 17,
						borderWidth: 2,
						borderStyle: "dashed",
						borderColor: "#DDE7F1",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<CloudUpload size={40} color="#D7DCE3" strokeWidth={1.7} />
					<View style={{ marginTop: 9, width: 78 }}>
						<GradientPillButton label="Hochladen" onPress={() => undefined} />
					</View>
					<Text className="mt-2 font-poppins text-body-5 text-secondary-text">
						oder Scanne deine Mitschriften
					</Text>
				</View>
			</View>
		</View>
	);
}

function PathIllustration() {
	return (
		<View
			style={{
				width: 280,
				height: 248,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Svg width={280} height={248} viewBox="0 0 280 248">
				<Path
					d="M150 30 H210 Q232 30 232 52 V104 Q232 128 208 128 H122 Q96 128 96 154 V180"
					stroke="#DCE6EE"
					strokeWidth="4"
					fill="none"
					strokeLinecap="round"
				/>
				<Path
					d="M150 30 H210 Q232 30 232 52 V104"
					stroke="#00BAFF"
					strokeWidth="4"
					fill="none"
					strokeLinecap="round"
				/>
				<Circle cx="140" cy="31" r="24" fill="#00BAFF" />
				<Circle cx="224" cy="92" r="24" fill="#00BAFF" />
				<Circle cx="140" cy="129" r="22" fill="#A4A9AF" />
				<Circle cx="74" cy="180" r="22" fill="#D7DCE3" />
				<Path
					d="M130 29 L138 38 L154 20"
					stroke="#FFFFFF"
					strokeWidth="5"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
				<Rect
					x="218"
					y="84"
					width="12"
					height="14"
					rx="2"
					fill="none"
					stroke="#FFFFFF"
					strokeWidth="2"
				/>
				<G transform="translate(133 121)">
					<Rect
						x="0"
						y="6"
						width="14"
						height="11"
						rx="3"
						fill="none"
						stroke="#FFFFFF"
						strokeWidth="2"
					/>
					<Path
						d="M4 6 V4 Q4 0 7 0 Q10 0 10 4 V6"
						stroke="#FFFFFF"
						strokeWidth="2"
						strokeLinecap="round"
						fill="none"
					/>
				</G>
				<G transform="translate(67 172)">
					<Rect
						x="0"
						y="6"
						width="14"
						height="11"
						rx="3"
						fill="none"
						stroke="#FFFFFF"
						strokeWidth="2"
					/>
					<Path
						d="M4 6 V4 Q4 0 7 0 Q10 0 10 4 V6"
						stroke="#FFFFFF"
						strokeWidth="2"
						strokeLinecap="round"
						fill="none"
					/>
				</G>
			</Svg>
		</View>
	);
}

function AnimatedFlower() {
	const rotation = useSharedValue(0);
	const pulse = useSharedValue(1);

	useEffect(() => {
		rotation.value = withRepeat(
			withTiming(360, { duration: 3600, easing: Easing.linear }),
			-1,
			false,
		);
		pulse.value = withRepeat(
			withSequence(
				withTiming(1.07, { duration: 900, easing: Easing.inOut(Easing.quad) }),
				withTiming(0.95, { duration: 900, easing: Easing.inOut(Easing.quad) }),
			),
			-1,
			true,
		);
	}, [pulse, rotation]);

	const style = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }, { scale: pulse.value }],
	}));

	return (
		<Animated.View style={[{ width: 190, height: 190 }, style]}>
			<Svg width={190} height={190} viewBox="0 0 190 190">
				{FLOWER_PETAL_KEYS.map((petalKey, index) => {
					const angle = (index * 36 * Math.PI) / 180;
					const cx = 95 + Math.cos(angle) * 34;
					const cy = 95 + Math.sin(angle) * 34;
					return (
						<Ellipse
							key={petalKey}
							cx={cx}
							cy={cy}
							rx="44"
							ry="30"
							fill="#00BAFF"
							opacity="0.38"
							transform={`rotate(${index * 36} ${cx} ${cy})`}
						/>
					);
				})}
			</Svg>
		</Animated.View>
	);
}
