import { Host, Picker } from "@expo/ui";
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
	type FlatList,
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
	Easing,
	FadeIn,
	FadeInDown,
	FadeInUp,
	interpolate,
	LinearTransition,
	type SharedValue,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
	Circle,
	Defs,
	Ellipse,
	Path,
	Rect,
	Stop,
	LinearGradient as SvgLinearGradient,
	type SvgProps,
} from "react-native-svg";
import { IntroTasksArtwork } from "~/components/onboarding/intro-tasks-artwork";
import type { DateTimePickerEvent } from "~/components/ui/date-time-picker-sheet";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import {
	ArrowLeft,
	ArrowRight,
	Atom,
	BookOpen,
	Bulb,
	Calculator,
	CalendarDays,
	Chemistry,
	ChevronDown,
	ClipboardEdit,
	ClipboardList,
	Dna,
	Earth,
	Eye,
	EyeOff,
	Football,
	Globe,
	GreekHelmet,
	Language,
	PaintBrush,
	Palette,
	Plant,
	Route2,
	SquareRootSquare,
	Telescope,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { useOnboarding } from "~/context/OnboardingContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useBackIntent } from "~/lib/navigation";
import IntroPathSvg from "../../../assets/onboarding/intro-path.svg";
import IntroUploadSvg from "../../../assets/onboarding/intro-upload.svg";

const COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const PRIMARY_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const DURATION_CAROUSEL_ACTIVE_COLOR = COLORS.primary;
const DURATION_CAROUSEL_INACTIVE_COLOR = COLORS.border;
const QUESTION_TITLE_STYLE = DAYOVA_DESIGN_SYSTEM.typography.headline.h2;
const QUESTION_TITLE_STYLE_COMPACT = {
	fontSize: 25,
	lineHeight: 32,
	fontWeight: "600",
} as const;
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
const DURATION_OPTIONS = [
	10, 20, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
] as const;
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_BIRTH_DAY = "09";
const DEFAULT_BIRTH_MONTH = "09";
const DEFAULT_BIRTH_YEAR = String(CURRENT_YEAR - 14);

const DEFAULT_BIRTH_DATE = `${DEFAULT_BIRTH_DAY}.${DEFAULT_BIRTH_MONTH}.${DEFAULT_BIRTH_YEAR}`;
const DEFAULT_LEARNING_TIME = "16:44";

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

function formatPickerTime(date: Date) {
	const hour = String(date.getHours()).padStart(2, "0");
	const minute = String(date.getMinutes()).padStart(2, "0");
	return `${hour}:${minute}`;
}

function parsePickerTime(value: string) {
	const match = /^(\d{2}):(\d{2})$/.exec(value);
	const [, hour = "16", minute = "44"] = match ?? [];
	const parsed = new Date();
	parsed.setHours(Number(hour), Number(minute), 0, 0);
	if (!Number.isNaN(parsed.getTime())) return parsed;

	const fallback = new Date();
	fallback.setHours(16, 44, 0, 0);
	return fallback;
}

const INTRO_REFERENCE_WIDTH = 393;
const INTRO_REFERENCE_HEIGHT = 852;
const IntroUploadArtwork = IntroUploadSvg as unknown as ComponentType<SvgProps>;
const IntroPathArtwork = IntroPathSvg as unknown as ComponentType<SvgProps>;
const INTRO_LAYOUTS = {
	tasks: {
		artwork: { width: 356, height: 242, top: 206 },
		titleTop: 501,
		dotsTop: 660,
		buttonTop: 704,
	},
	upload: {
		artwork: { width: 345, height: 313, top: 153 },
		titleTop: 510,
		dotsTop: 660,
		buttonTop: 704,
	},
	path: {
		artwork: { width: 369, height: 467, top: 131 },
		titleTop: 574,
		dotsTop: 720,
		buttonTop: 760,
	},
} as const satisfies Record<
	IntroStep["illustration"],
	{
		artwork: { width: number; height: number; top: number };
		titleTop: number;
		dotsTop: number;
		buttonTop: number;
	}
>;
const INTRO_ARTWORKS = [
	{ kind: "tasks", Component: IntroTasksArtwork },
	{ kind: "upload", Component: IntroUploadArtwork },
	{ kind: "path", Component: IntroPathArtwork },
] as const satisfies readonly {
	kind: IntroStep["illustration"];
	Component: ComponentType<SvgProps>;
}[];
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
		values: DURATION_OPTIONS,
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
		values: DURATION_OPTIONS,
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
		placeholder: "max.mustermann@gmail.de",
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
		if (step.field === "birthDate") return DEFAULT_BIRTH_DATE;
		if (step.field === "learningTime") return DEFAULT_LEARNING_TIME;
	}
	return "";
};

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
		<View style={{ flex: 1, backgroundColor: COLORS.background }}>
			<Stack.Screen options={{ title: "Dayova" }} />
			<StatusBar style="dark" />
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
							className="text-center font-bold font-poppins text-text"
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
				{isIntro ? (
					<IntroStepView
						step={activeStep}
						activeIndex={activeIndex}
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
							error={error}
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
	step,
	activeIndex,
	onNext,
}: {
	step: IntroStep;
	activeIndex: number;
	onNext: () => void;
}) {
	const { width, height } = useWindowDimensions();
	const scale = Math.min(
		width / INTRO_REFERENCE_WIDTH,
		height / INTRO_REFERENCE_HEIGHT,
	);
	const layout = INTRO_LAYOUTS[step.illustration];
	const titleWidth = 360 * scale;
	const nextButtonSize = 76 * scale;
	const nextButtonTop = Math.min(
		layout.buttonTop * scale,
		height - nextButtonSize - 48 * scale,
	);
	const dotsTop = Math.min(layout.dotsTop * scale, nextButtonTop - 44 * scale);

	return (
		<View style={{ flex: 1 }}>
			{INTRO_ARTWORKS.map((artwork, index) => {
				const artworkLayout = INTRO_LAYOUTS[artwork.kind];
				const artworkWidth = artworkLayout.artwork.width * scale;
				const artworkHeight = artworkLayout.artwork.height * scale;
				const SvgArtwork = artwork.Component;
				const active = artwork.kind === step.illustration;

				return (
					<View
						key={artwork.kind}
						pointerEvents="none"
						style={{
							position: "absolute",
							left: (width - artworkWidth) / 2,
							top: artworkLayout.artwork.top * scale,
							width: artworkWidth,
							height: artworkHeight,
							alignItems: "center",
							justifyContent: "center",
							opacity: active ? 1 : 0,
							transform: [{ translateX: (index - activeIndex) * 18 * scale }],
						}}
					>
						<SvgArtwork width={artworkWidth} height={artworkHeight} />
					</View>
				);
			})}

			<Animated.Text
				entering={FadeInUp.delay(80).duration(380).springify().damping(18)}
				style={{
					position: "absolute",
					left: (width - titleWidth) / 2,
					top: layout.titleTop * scale,
					width: titleWidth,
					textAlign: "center",
					fontFamily: "Poppins",
					fontWeight: "700",
					fontSize: 32 * scale,
					lineHeight: 36.6 * scale,
					color: COLORS.text,
				}}
			>
				{step.title}
			</Animated.Text>

			<View
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: dotsTop,
					alignItems: "center",
				}}
			>
				<IntroDots activeIndex={activeIndex} />
			</View>
			<CircularNextButton
				onPress={onNext}
				progress={(activeIndex + 1) / INTRO_ARTWORKS.length}
				style={{
					position: "absolute",
					left: (width - nextButtonSize) / 2,
					top: nextButtonTop,
					transform: [{ scale }],
				}}
			/>
		</View>
	);
}

function QuestionStepView({
	step,
	progress,
	error,
	passwordVisible,
	inputRef,
	bottomInset,
	onBack,
	onContinue,
	onTogglePassword,
}: {
	step: Exclude<OnboardingStep, IntroStep>;
	progress: number;
	error: string | null;
	passwordVisible: boolean;
	inputRef: RefObject<TextInput | null>;
	bottomInset: number;
	onBack: () => boolean;
	onContinue: () => void;
	onTogglePassword: () => void;
}) {
	const { answers, setAnswer } = useOnboarding();
	const showBottomButton = step.kind !== "text";
	const buttonDisabled = step.kind === "fact" && step.disabledButton;
	const isRangeStep = step.kind === "range";
	const isShortFactStep =
		step.kind === "fact" && step.id === "short-study-fact";
	const isPlanFitStep = step.kind === "infoStack";
	const questionTitleStyle =
		step.kind === "range" ? QUESTION_TITLE_STYLE : QUESTION_TITLE_STYLE_COMPACT;
	const titleTopPadding = isRangeStep
		? 36
		: isShortFactStep
			? 42
			: isPlanFitStep
				? 36
				: step.kind === "text"
					? 50
					: step.kind === "chips"
						? 24
						: 36;
	const contentTopMargin = isRangeStep
		? 28
		: isShortFactStep
			? 14
			: isPlanFitStep
				? 22
				: step.kind === "chips"
					? 40
					: step.kind === "goals"
						? 28
						: step.kind === "text"
							? 22
							: 30;

	return (
		<View style={{ flex: 1 }}>
			<AuthProgressHeader progress={progress} onBack={onBack} />

			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentInsetAdjustmentBehavior="never"
				showsVerticalScrollIndicator={false}
				style={{ flex: 1 }}
				contentContainerStyle={{
					flexGrow: 1,
					paddingBottom: showBottomButton
						? Math.max(bottomInset + 112, 122)
						: Math.max(bottomInset + 20, 32),
				}}
			>
				<Animated.View
					entering={FadeInDown.duration(360).springify().damping(18)}
					layout={LinearTransition.duration(220)}
					style={{
						flex: 1,
						alignItems: "center",
						paddingTop: titleTopPadding,
					}}
				>
					<Text
						className="text-center font-poppins"
						style={{
							color: COLORS.text,
							fontSize: questionTitleStyle.fontSize,
							lineHeight: questionTitleStyle.lineHeight,
							fontWeight: questionTitleStyle.fontWeight,
						}}
					>
						{step.title}
					</Text>

					<View
						style={{
							width: "100%",
							marginTop: contentTopMargin,
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
			</ScrollView>

			{showBottomButton ? (
				<View
					style={{
						paddingTop: 8,
						paddingBottom: Math.max(bottomInset + 52, 60),
					}}
				>
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
								Jetzt Registrieren
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
			<View
				style={{
					flex: 1,
					height: 8,
					borderRadius: 999,
					overflow: "hidden",
					backgroundColor: "#CFEAFF",
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
	const listRef = useRef<FlatList<number>>(null);
	const { width } = useWindowDimensions();
	const carouselWidth = Math.min(width, 360);
	const itemWidth = 68;
	const sidePadding = Math.max((carouselWidth - itemWidth) / 2, 0);
	const scrollX = useSharedValue(selectedIndex * itemWidth);
	const lastIndex = Math.max(values.length - 1, 0);
	const selectIndex = useCallback(
		(nextIndex: number) => {
			const clampedIndex = Math.min(Math.max(nextIndex, 0), lastIndex);
			const nextValue = values[clampedIndex];
			if (nextValue === undefined) return;
			onChange(`${nextValue} min`);
			listRef.current?.scrollToOffset({
				offset: clampedIndex * itemWidth,
				animated: true,
			});
		},
		[lastIndex, onChange, values],
	);

	useEffect(() => {
		scrollX.set(selectedIndex * itemWidth);
		listRef.current?.scrollToOffset({
			offset: selectedIndex * itemWidth,
			animated: false,
		});
	}, [scrollX, selectedIndex]);

	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (event) => {
			scrollX.set(event.contentOffset.x);
		},
	});

	const handleMomentumEnd = useCallback(
		(offsetX: number) => {
			const nextIndex = Math.min(
				Math.max(Math.round(offsetX / itemWidth), 0),
				lastIndex,
			);
			const nextValue = values[nextIndex];
			if (nextValue === undefined || nextValue === selected) return;
			onChange(`${nextValue} min`);
		},
		[lastIndex, onChange, selected, values],
	);

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

			<View
				accessibilityRole="adjustable"
				accessibilityLabel={accessibilityLabel}
				accessibilityValue={{ text: `${selected} Minuten` }}
				accessibilityActions={[
					{ name: "increment", label: "Mehr Zeit" },
					{ name: "decrement", label: "Weniger Zeit" },
				]}
				onAccessibilityAction={handleAccessibilityAction}
				style={{
					marginTop: 48,
					width: carouselWidth,
					height: 92,
					justifyContent: "center",
				}}
			>
				<Animated.FlatList
					ref={listRef}
					data={values as readonly number[]}
					keyExtractor={(minutes) => String(minutes)}
					horizontal
					bounces={false}
					decelerationRate="fast"
					snapToInterval={itemWidth}
					snapToAlignment="start"
					showsHorizontalScrollIndicator={false}
					scrollEventThrottle={16}
					onScroll={scrollHandler}
					onMomentumScrollEnd={(event) =>
						handleMomentumEnd(event.nativeEvent.contentOffset.x)
					}
					onScrollEndDrag={(event) =>
						handleMomentumEnd(event.nativeEvent.contentOffset.x)
					}
					getItemLayout={(_, index) => ({
						length: itemWidth,
						offset: itemWidth * index,
						index,
					})}
					contentContainerStyle={{
						paddingHorizontal: sidePadding,
						alignItems: "center",
					}}
					style={{ flexGrow: 0 }}
					renderItem={({ index }) => (
						<DurationCarouselItem
							index={index}
							itemWidth={itemWidth}
							scrollX={scrollX}
						/>
					)}
				/>
			</View>
		</View>
	);
}

function DurationCarouselItem({
	index,
	itemWidth,
	scrollX,
}: {
	index: number;
	itemWidth: number;
	scrollX: SharedValue<number>;
}) {
	const animatedStyle = useAnimatedStyle(() => {
		const distance = Math.abs(scrollX.get() / itemWidth - index);
		const scale = interpolate(distance, [0, 1, 2], [1, 0.82, 0.72], "clamp");
		const opacity = interpolate(distance, [0, 1, 2], [1, 0.82, 0.58], "clamp");

		return {
			opacity,
			transform: [{ scale }],
		};
	});

	const barStyle = useAnimatedStyle(() => {
		const distance = Math.abs(scrollX.get() / itemWidth - index);
		const height = interpolate(distance, [0, 1, 2], [72, 36, 28], "clamp");
		const width = interpolate(distance, [0, 1, 2], [7, 4, 3], "clamp");
		const isActive = distance < 0.5;

		return {
			width,
			height,
			backgroundColor: isActive
				? DURATION_CAROUSEL_ACTIVE_COLOR
				: DURATION_CAROUSEL_INACTIVE_COLOR,
		};
	});

	return (
		<Animated.View
			style={[
				{
					width: itemWidth,
					height: 78,
					alignItems: "center",
					justifyContent: "center",
				},
				animatedStyle,
			]}
		>
			<Animated.View
				style={[
					{
						borderRadius: 3,
					},
					barStyle,
				]}
			/>
		</Animated.View>
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
				width: "88%",
				flexDirection: "row",
				flexWrap: "wrap",
				justifyContent: "center",
				columnGap: 10,
				rowGap: 12,
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
							accessibilityRole="checkbox"
							accessibilityState={{ checked: selected }}
							onPress={() => onToggle(option.label)}
							style={{
								minHeight: 36,
								borderRadius: DAYOVA_DESIGN_SYSTEM.radius.button,
								paddingHorizontal: option.label.length > 8 ? 12 : 16,
								paddingVertical: 8,
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
								overflow: "hidden",
								backgroundColor: selected ? COLORS.primary : COLORS.surface,
								borderWidth: selected
									? 0
									: DAYOVA_DESIGN_SYSTEM.size.button.borderWidth,
								borderColor: COLORS.border,
								boxShadow: selected
									? "0 8px 18px rgba(0, 186, 255, 0.14)"
									: "0 8px 18px rgba(20, 28, 48, 0.05)",
							}}
						>
							{selected ? (
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
							{Icon ? (
								<Icon
									size={18}
									color={selected ? COLORS.surface : COLORS.primary}
									strokeWidth={2}
								/>
							) : null}
							<Text
								className="font-poppins"
								style={{
									color: selected ? COLORS.surface : COLORS.text,
									fontSize: DAYOVA_DESIGN_SYSTEM.typography.body.sm.fontSize,
									lineHeight:
										DAYOVA_DESIGN_SYSTEM.typography.body.sm.lineHeight,
									fontWeight:
										DAYOVA_DESIGN_SYSTEM.typography.body.sm.fontWeight,
								}}
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
	const cardTransforms = [
		{ rotate: "-2.5deg", translateX: -1 },
		{ rotate: "2deg", translateX: 1 },
		{ rotate: "-2deg", translateX: -1 },
	] as const;

	return (
		<View
			style={{
				width: "100%",
				minHeight: 390,
				alignItems: "center",
				overflow: "visible",
			}}
		>
			<View
				pointerEvents="none"
				style={{
					position: "absolute",
					top: -4,
					width: 502,
					height: 508,
					opacity: 1,
				}}
			>
				<PhoneBackground width="100%" height="115%" />
			</View>
			<View style={{ position: "absolute", top: 58, width: "100%", gap: 18 }}>
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
								width: "84%",
								alignSelf: "center",
								minHeight: 64,
								borderRadius: 14,
								backgroundColor: COLORS.surface,
								paddingHorizontal: 14,
								flexDirection: "row",
								alignItems: "center",
								gap: 14,
								boxShadow: "0 12px 22px rgba(20, 28, 48, 0.05)",
								transform: [
									{ translateX: cardTransforms[index].translateX },
									{ rotate: cardTransforms[index].rotate },
								],
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
							<Text
								className="flex-1 font-poppins"
								style={{ color: COLORS.text, fontSize: 14, lineHeight: 20 }}
							>
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
	const [pickerTarget, setPickerTarget] = useState<
		"birthDate" | "learningTime" | null
	>(null);

	if (step.field === "birthDate") {
		const value = answers.birthDate || DEFAULT_BIRTH_DATE;
		const selectedDate = parsePickerDate(value);
		const handleChange = (event: DateTimePickerEvent, nextDate?: Date) => {
			if (Platform.OS === "android") setPickerTarget(null);
			if (event.type === "dismissed" || !nextDate) return;
			setAnswer("birthDate", formatPickerDate(nextDate));
		};

		return (
			<View style={{ width: "100%", alignItems: "center" }}>
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
						onClose={() => setPickerTarget(null)}
					/>
				) : null}
			</View>
		);
	}

	if (step.field === "learningTime") {
		const value = answers.learningTime || DEFAULT_LEARNING_TIME;
		const selectedTime = parsePickerTime(value);
		const handleChange = (event: DateTimePickerEvent, nextDate?: Date) => {
			if (Platform.OS === "android") setPickerTarget(null);
			if (event.type === "dismissed" || !nextDate) return;
			setAnswer("learningTime", formatPickerTime(nextDate));
		};

		return (
			<View style={{ width: "100%", alignItems: "center" }}>
				<PickerInputTrigger
					accessibilityLabel="Lernzeit auswählen"
					value={value}
					placeholder="Uhrzeit auswählen"
					onPress={() => setPickerTarget("learningTime")}
				/>
				{pickerTarget === "learningTime" ? (
					<DateTimePickerSheet
						visible
						value={selectedTime}
						mode="time"
						onChange={handleChange}
						onClose={() => setPickerTarget(null)}
					/>
				) : null}
			</View>
		);
	}

	if (step.field === "grade") {
		return (
			<NativeOnboardingPicker
				value={answers.grade || "9"}
				options={GRADE_OPTIONS}
				formatLabel={(grade) => `${grade}. Klasse`}
				testID="onboarding-grade-picker"
				onChange={(value) => setAnswer("grade", value)}
			/>
		);
	}

	return (
		<NativeOnboardingPicker
			value={answers.state || "Sachsen"}
			options={FEDERAL_STATES}
			testID="onboarding-state-picker"
			onChange={(value) => setAnswer("state", value)}
		/>
	);
}

function PickerInputTrigger({
	value,
	placeholder,
	accessibilityLabel,
	onPress,
}: {
	value: string;
	placeholder: string;
	accessibilityLabel: string;
	onPress: () => void;
}) {
	const hasValue = value.trim().length > 0;

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			onPress={onPress}
			style={{
				width: "100%",
				maxWidth: 312,
				minHeight: 58,
				borderRadius: 29,
				backgroundColor: COLORS.surface,
				borderWidth: 1,
				borderColor: "rgba(17,24,39,0.05)",
				boxShadow: "0 12px 22px rgba(20, 28, 48, 0.05)",
				paddingHorizontal: 20,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
			}}
		>
			<Text
				className="flex-1 font-poppins text-body-2"
				numberOfLines={1}
				style={{ color: hasValue ? COLORS.text : "rgba(26,26,26,0.42)" }}
			>
				{hasValue ? value : placeholder}
			</Text>
			<ChevronDown size={20} color={COLORS.secondaryText} strokeWidth={2.1} />
		</Pressable>
	);
}

function NativeOnboardingPicker({
	value,
	options,
	formatLabel = (option) => option,
	testID,
	onChange,
}: {
	value: string;
	options: readonly string[];
	formatLabel?: (option: string) => string;
	testID: string;
	onChange: (value: string) => void;
}) {
	return (
		<View
			style={{
				width: "100%",
				maxWidth: 312,
				minHeight: 58,
				borderRadius: 29,
				backgroundColor: COLORS.surface,
				borderWidth: 1,
				borderColor: "rgba(17,24,39,0.05)",
				boxShadow: "0 12px 22px rgba(20, 28, 48, 0.05)",
				paddingHorizontal: 14,
				justifyContent: "center",
				overflow: "hidden",
			}}
		>
			<Host style={{ minHeight: 44, justifyContent: "center" }}>
				<Picker
					selectedValue={value}
					onValueChange={onChange}
					appearance="menu"
					testID={testID}
				>
					{options.map((option) => (
						<Picker.Item
							key={option}
							label={formatLabel(option)}
							value={option}
						/>
					))}
				</Picker>
			</Host>
		</View>
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
	progress,
	style,
}: {
	onPress: () => void;
	disabled?: boolean;
	progress: number;
	style?: object;
}) {
	const circumference = 2 * Math.PI * 34;
	const clampedProgress = Math.min(Math.max(progress, 0.08), 1);

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
			<View style={{ position: "absolute", width: 76, height: 76 }}>
				<Svg width={76} height={76}>
					<Circle
						cx="38"
						cy="38"
						r="34"
						fill="transparent"
						stroke="rgba(26,26,26,0.12)"
						strokeWidth="4"
					/>
					<Circle
						cx="38"
						cy="38"
						r="34"
						fill="transparent"
						stroke={disabled ? "rgba(26,26,26,0.18)" : COLORS.primary}
						strokeWidth="4"
						strokeLinecap="round"
						strokeDasharray={`${circumference * clampedProgress} ${circumference}`}
						transform="rotate(-90 38 38)"
					/>
				</Svg>
			</View>
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
			<Text
				className="font-bold font-poppins text-body-2"
				style={{ color: COLORS.surface }}
			>
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
				backgroundColor: COLORS.buttonNeutral,
				boxShadow: disabled ? "none" : "0 8px 18px rgba(20, 28, 48, 0.08)",
			}}
		>
			<Text
				className="font-bold font-poppins text-body-2"
				style={{ color: COLORS.surface }}
			>
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
		<View style={{ flex: 1 }}>
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

function PhoneBackground(props: SvgProps) {
	return (
		<Svg width={393} height={583} viewBox="0 0 393 583" fill="none" {...props}>
			<Rect
				x="42.7754"
				y="15.6278"
				width="307.449"
				height="665.744"
				rx="52"
				fill="white"
			/>
			<Path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M33.2685 30.7185C27.1293 42.7532 27.1293 58.5075 27.1293 90.0162V124.241H25.5646C24.7005 124.241 24 124.941 24 125.804V147.683C24 148.546 24.7005 149.246 25.5646 149.246H27.1293V169.562H25.5646C24.7005 169.562 24 170.261 24 171.124V216.445C24 217.308 24.7005 218.008 25.5646 218.008H27.1293V232.854H25.5646C24.7005 232.854 24 233.554 24 234.417V279.738C24 280.601 24.7005 281.3 25.5646 281.3H27.1293V606.984C27.1293 638.492 27.1293 654.247 33.2685 666.281C38.6687 676.867 47.2856 685.474 57.8841 690.868C69.933 697 85.7059 697 117.252 697H275.748C307.294 697 323.067 697 335.116 690.868C345.714 685.474 354.331 676.867 359.732 666.281C365.871 654.247 365.871 638.492 365.871 606.984V280.519H367.435C368.299 280.519 369 279.819 369 278.956V205.506C369 204.642 368.299 203.943 367.435 203.943H365.871V90.0162C365.871 58.5075 365.871 42.7532 359.732 30.7185C354.331 20.1325 345.714 11.5258 335.116 6.13198C323.067 0 307.294 0 275.748 0H117.252C85.7059 0 69.933 0 57.8841 6.13198C47.2856 11.5258 38.6687 20.1325 33.2685 30.7185ZM47.2094 37.8134C42.7755 46.5051 42.7755 57.8833 42.7755 80.6395V616.361C42.7755 639.117 42.7755 650.495 47.2094 659.187C51.1096 666.832 57.3328 673.048 64.9873 676.944C73.6893 681.372 85.0809 681.372 107.864 681.372H285.136C307.919 681.372 319.311 681.372 328.013 676.944C335.667 673.048 341.89 666.832 345.791 659.187C350.224 650.495 350.224 639.117 350.224 616.361V80.6395C350.224 57.8832 350.224 46.5051 345.791 37.8134C341.89 30.168 335.667 23.952 328.013 20.0565C319.311 15.6278 307.919 15.6278 285.136 15.6278H107.864C85.0809 15.6278 73.6893 15.6278 64.9873 20.0565C57.3328 23.952 51.1096 30.168 47.2094 37.8134Z"
				fill="#F2F2F5"
			/>
			<Path
				d="M149.952 37.5067C149.952 29.7388 156.257 23.4417 164.034 23.4417H225.837C233.614 23.4417 239.918 29.7388 239.918 37.5067C239.918 45.2746 233.614 51.5717 225.837 51.5717H164.034C156.257 51.5717 149.952 45.2746 149.952 37.5067Z"
				fill="#F2F2F5"
			/>
			<Path
				d="M231.313 36.7253C231.313 39.3146 229.211 41.4137 226.619 41.4137C224.026 41.4137 221.925 39.3146 221.925 36.7253C221.925 34.136 224.026 32.037 226.619 32.037C229.211 32.037 231.313 34.136 231.313 36.7253Z"
				fill="#DEDEE4"
			/>
			<Rect
				x="-110.697"
				y="211.377"
				width="530.783"
				height="466.956"
				transform="rotate(-15 -110.697 211.377)"
				fill="url(#paint0_linear_2375_9304)"
			/>
			<Defs>
				<SvgLinearGradient
					id="paint0_linear_2375_9304"
					x1="154.694"
					y1="211.377"
					x2="154.694"
					y2="678.332"
					gradientUnits="userSpaceOnUse"
				>
					<Stop stopColor="white" stopOpacity="0.05" />
					<Stop offset="1" stopColor="#F6F6F4" />
				</SvgLinearGradient>
			</Defs>
		</Svg>
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
