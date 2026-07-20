import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Device from "expo-device";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	AppState,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	type TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import type {
	PermissionStatus as NitroPermissionStatus,
	SpeechRecognitionError as NitroSpeechRecognitionError,
	RecognizerCallbacks,
	RecognizerMethods,
	SpeechRecognitionConfig,
} from "react-native-nitro-speech";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { QuestionProgressBar } from "~/components/question-progress-bar";
import { ScreenHeader } from "~/components/screen-header";
import { BackButton, Button } from "~/components/ui/button";
import {
	BookOpen,
	Check,
	CircleAlert,
	ClipboardEdit,
	Mic,
	Pencil,
	Timer,
} from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { PracticeCompletionCard } from "~/features/learning-plans/practice-completion-card";
import {
	CONTINUE_LEARNING_MINUTES,
	getLearningSessionCompletionPhase,
	getLearningSessionItems,
	getLearningSessionTimerDurationSeconds,
	isQualifiedSessionCompletion,
} from "~/features/learning-plans/session-progress";
import { runTheoryTopicPrimaryAction } from "~/features/learning-plans/theory-topic";
import { TheoryTopicPage } from "~/features/learning-plans/theory-topic-page";
import type {
	LearningSessionContentSnapshot,
	SessionAnswerAttempt,
	SessionAnswerRating,
	SessionContentItem,
} from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { useValidationAnalytics } from "~/lib/analytics";
import { definedAnalyticsProperties } from "~/lib/analytics-core";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { logDiagnosticError } from "~/lib/diagnostics";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type SpeechRecognitionModule = typeof import("react-native-nitro-speech");
type PermissionStatus = NitroPermissionStatus;
type SpeechRecognitionError = NitroSpeechRecognitionError;

const PermissionStatus = {
	GRANTED: 0,
	DENIED: 1,
	NOT_REQUESTED: 2,
} as const satisfies Record<
	"GRANTED" | "DENIED" | "NOT_REQUESTED",
	NitroPermissionStatus
>;

const SpeechRecognitionError = {
	Unknown: 0,
	LocaleNotSupported: 1,
	RecognitionTaskFailed: 2,
	IosSpeechPermissionNotDetermined: 3,
	SessionStartFailed: 4,
} as const satisfies Record<
	| "Unknown"
	| "LocaleNotSupported"
	| "RecognitionTaskFailed"
	| "IosSpeechPermissionNotDetermined"
	| "SessionStartFailed",
	NitroSpeechRecognitionError
>;

const ratingCopy: Record<
	SessionAnswerRating,
	{
		title: string;
		color: string;
		subtleClassName: string;
		textClassName: string;
	}
> = {
	notCorrect: {
		title: "Noch nicht gewusst",
		color: DAYOVA_DESIGN_SYSTEM.colors.wrong,
		subtleClassName: "bg-wrong-subtle",
		textClassName: "text-wrong",
	},
	partiallyCorrect: {
		title: "Teilweise richtig",
		color: DAYOVA_DESIGN_SYSTEM.colors.info,
		subtleClassName: "bg-info-subtle",
		textClassName: "text-info",
	},
	correct: {
		title: "Richtige Antwort",
		color: DAYOVA_DESIGN_SYSTEM.colors.success,
		subtleClassName: "bg-success-subtle",
		textClassName: "text-success",
	},
};

const phaseTitle = (
	phase: LearningSessionContentSnapshot["session"]["phase"],
) =>
	phase === "theory" ? "Lernkarten" : phase === "practice" ? "Üben" : "Praxis";

const learningSessionAnalyticsProperties = (result: {
	learningPlanId: Id<"learningPlans">;
	learningPlanSessionId: Id<"learningPlanSessions">;
	phase: LearningSessionContentSnapshot["session"]["phase"];
	plannedDayKey: string;
	startTime: string;
	durationMinutes: number;
	compositionVariant: "control" | "split";
	activeStudySeconds?: number;
	subject: string;
	examTypeLabel?: string;
	examDateKey?: string;
}) =>
	definedAnalyticsProperties({
		learning_plan_id: result.learningPlanId,
		learning_plan_session_id: result.learningPlanSessionId,
		phase: result.phase,
		planned_day_key: result.plannedDayKey,
		start_time: result.startTime,
		duration_minutes: result.durationMinutes,
		session_composition_variant: result.compositionVariant,
		active_study_seconds: result.activeStudySeconds,
		subject: result.subject,
		exam_type_label: result.examTypeLabel,
		exam_date_key: result.examDateKey,
	});

const isIosSimulator = Platform.OS === "ios" && !Device.isDevice;
const iosSimulatorSpeechMessage =
	"Spracherkennung ist im iOS Simulator nicht zuverlässig verfügbar. Auf einem iPhone kannst du deine Antwort einsprechen. Hier kannst du sie stattdessen eintippen.";
const nativeSpeechUnavailableMessage =
	"Spracherkennung ist in dieser App-Version nicht verfügbar. Du kannst deine Antwort stattdessen eintippen.";

const getSpeechRecognitionErrorMessage = (error: SpeechRecognitionError) => {
	if (error === SpeechRecognitionError.LocaleNotSupported) {
		return "Spracherkennung ist auf diesem Gerät für Deutsch gerade nicht verfügbar. Du kannst die Antwort als Text eintragen.";
	}
	if (error === SpeechRecognitionError.RecognitionTaskFailed) {
		return "Wir haben keine Sprache erkannt. Versuch es noch einmal oder bearbeite das Transkript direkt.";
	}
	if (error === SpeechRecognitionError.IosSpeechPermissionNotDetermined) {
		return "Dieses Gerät unterstützt die aktuelle Spracherkennung nicht vollständig. Du kannst die Antwort als Text eintragen.";
	}
	if (error === SpeechRecognitionError.SessionStartFailed) {
		return "Die Spracherkennung konnte nicht gestartet werden. Du kannst die Antwort als Text eintragen.";
	}

	return "Die Spracherkennung konnte nicht gestartet werden. Du kannst die Antwort als Text eintragen.";
};

const getSpeechPermissionMessage = (status: PermissionStatus) =>
	status === PermissionStatus.DENIED
		? "Mikrofon oder Spracherkennung sind blockiert. Aktiviere sie in den Geräteeinstellungen oder trage die Antwort als Text ein."
		: "Bitte erlaube Mikrofon und Spracherkennung, damit Dayova deine Sprachantwort transkribieren kann.";

type OptionalSpeechRecognizer = RecognizerMethods & {
	isAvailable: boolean;
	loadError: unknown | null;
};

const unavailableSpeechRecognizerMethods: RecognizerMethods = {
	prewarm: async () => {
		throw new Error("Speech recognition is unavailable.");
	},
	startListening: () => undefined,
	stopListening: () => undefined,
	resetAutoFinishTime: () => undefined,
	addAutoFinishTime: () => undefined,
	updateConfig: () => undefined,
	getIsActive: () => false,
	getVoiceInputVolume: () => ({ smoothedVolume: 0, rawVolume: 0 }),
	getPermissions: () => PermissionStatus.DENIED,
	getSupportedLocalesIOS: () => [],
};

type SpeechRecognizerLoadState =
	| {
			recognizer: SpeechRecognitionModule["SpeechRecognizer"];
			methods: RecognizerMethods;
			loadError: null;
	  }
	| {
			recognizer: null;
			methods: null;
			loadError: unknown;
	  };

function loadSpeechRecognizer(): SpeechRecognizerLoadState {
	try {
		// Keep Nitro out of module scope so the route can render without it.
		const speechModule =
			require("react-native-nitro-speech") as SpeechRecognitionModule;
		const recognizer = speechModule.SpeechRecognizer;

		return {
			recognizer,
			methods: {
				prewarm: (params, options) => recognizer.prewarm(params, options),
				startListening: (params) => recognizer.startListening(params),
				stopListening: () => recognizer.stopListening(),
				resetAutoFinishTime: () => recognizer.resetAutoFinishTime(),
				addAutoFinishTime: (additionalTimeMs) =>
					recognizer.addAutoFinishTime(additionalTimeMs),
				updateConfig: (newConfig, resetAutoFinishTime) =>
					recognizer.updateConfig(newConfig, resetAutoFinishTime),
				getIsActive: () => recognizer.getIsActive(),
				getVoiceInputVolume: () => recognizer.getVoiceInputVolume(),
				getPermissions: () => recognizer.getPermissions(),
				getSupportedLocalesIOS: () =>
					recognizer.getSupportedLocalesIOS().sort(),
			},
			loadError: null,
		};
	} catch (error) {
		return {
			recognizer: null,
			methods: null,
			loadError: error,
		};
	}
}

let cachedSpeechRecognizerLoadState: SpeechRecognizerLoadState | null = null;

function getSpeechRecognizerLoadState(): SpeechRecognizerLoadState {
	cachedSpeechRecognizerLoadState ??= loadSpeechRecognizer();
	return cachedSpeechRecognizerLoadState;
}

function useOptionalSpeechRecognizer(
	callbacks: RecognizerCallbacks,
): OptionalSpeechRecognizer {
	const callbacksRef = useRef(callbacks);
	const [loadState] = useState(getSpeechRecognizerLoadState);
	const { methods, loadError } = loadState;

	useEffect(() => {
		callbacksRef.current = callbacks;
	}, [callbacks]);

	useEffect(() => {
		const recognizer = getSpeechRecognizerLoadState().recognizer;
		if (!recognizer) return undefined;

		recognizer.onReadyForSpeech = () =>
			callbacksRef.current.onReadyForSpeech?.();
		recognizer.onRecordingStopped = () =>
			callbacksRef.current.onRecordingStopped?.();
		recognizer.onResult = (resultBatches) =>
			callbacksRef.current.onResult?.(resultBatches);
		recognizer.onAutoFinishProgress = (timeLeftMs) =>
			callbacksRef.current.onAutoFinishProgress?.(timeLeftMs);
		recognizer.onError = (error) => callbacksRef.current.onError?.(error);
		recognizer.onPermissionDenied = () =>
			callbacksRef.current.onPermissionDenied?.();
		recognizer.onVolumeChange = (event) =>
			callbacksRef.current.onVolumeChange?.(event);

		return () => {
			try {
				recognizer.stopListening();
			} catch {
				// Native speech may be half-initialized during teardown.
			}

			recognizer.onReadyForSpeech = undefined;
			recognizer.onRecordingStopped = undefined;
			recognizer.onResult = undefined;
			recognizer.onAutoFinishProgress = undefined;
			recognizer.onError = undefined;
			recognizer.onPermissionDenied = undefined;
			recognizer.onVolumeChange = undefined;
		};
	}, []);

	return useMemo(
		() => ({
			...(methods ?? unavailableSpeechRecognizerMethods),
			isAvailable: Boolean(methods),
			loadError,
		}),
		[loadError, methods],
	);
}

const formatRemainingTime = (seconds: number) => {
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${rest
		.toString()
		.padStart(2, "0")}`;
};

function TagPill({
	label,
	icon,
}: {
	label: string;
	icon: "answer" | "evaluation" | "question";
}) {
	const Icon =
		icon === "answer"
			? Pencil
			: icon === "evaluation"
				? ClipboardEdit
				: CircleAlert;

	return (
		<View className="flex-row items-center gap-2 self-start rounded-full bg-system-subtle px-3 py-2">
			<Icon
				size={16}
				color={DAYOVA_DESIGN_SYSTEM.colors.primary}
				strokeWidth={2.1}
			/>
			<Text className="font-poppins font-semibold text-body-4 text-primary">
				{label}
			</Text>
		</View>
	);
}

function ActionRow({
	secondaryLabel,
	primaryLabel,
	onSecondary,
	onPrimary,
	primaryDisabled,
	isBusy,
	className,
}: {
	secondaryLabel: string;
	primaryLabel: string;
	onSecondary: () => void;
	onPrimary: () => void;
	primaryDisabled?: boolean;
	isBusy?: boolean;
	className?: string;
}) {
	return (
		<View className={cn("mt-8 flex-row gap-3", className)}>
			<Button
				className="flex-1 px-4"
				disabled={isBusy}
				variant="neutral"
				onPress={onSecondary}
			>
				<Text>{secondaryLabel}</Text>
			</Button>
			<Button
				className="flex-1 px-4"
				disabled={primaryDisabled || isBusy}
				onPress={onPrimary}
			>
				{isBusy ? (
					<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
				) : (
					<Text>{primaryLabel}</Text>
				)}
			</Button>
		</View>
	);
}

function FeedbackView({ attempt }: { attempt: SessionAnswerAttempt }) {
	const copy = ratingCopy[attempt.rating];
	const StatusIcon = attempt.rating === "correct" ? Check : CircleAlert;
	return (
		<View className="flex-1 justify-between">
			<View className="items-center pt-6">
				<View
					className={cn(
						"h-20 w-20 items-center justify-center rounded-full",
						copy.subtleClassName,
					)}
				>
					<StatusIcon size={34} color={copy.color} strokeWidth={2.4} />
				</View>
				<Text
					className={cn(
						"mt-3 font-poppins font-semibold text-body-3",
						copy.textClassName,
					)}
				>
					{copy.title}
				</Text>
			</View>

			<View className="mt-9">
				<Surface className="rounded-[32px] px-5 py-6" variant="flat">
					<TagPill label="Auswertung" icon="evaluation" />
					<Text className="mt-8 font-poppins text-body-2 text-secondary-text">
						{attempt.feedback}
					</Text>
				</Surface>
				<View className="mx-8 my-8 h-px bg-border" />
				<Surface className="rounded-[32px] px-5 py-6" variant="flat">
					<TagPill label="Ideale Antwort" icon="answer" />
					<Text className="mt-8 font-poppins text-body-2 text-secondary-text">
						{attempt.perfectAnswer}
					</Text>
				</Surface>
			</View>
		</View>
	);
}

function CompletionView({
	phase,
	durationMinutes,
	correctCount,
	attemptCount,
	onContinueLearning,
	onPrimary,
	isBusy,
}: {
	phase: LearningSessionContentSnapshot["session"]["phase"];
	durationMinutes: number;
	correctCount: number;
	attemptCount: number;
	onContinueLearning: () => void;
	onPrimary: () => void;
	isBusy: boolean;
}) {
	const isTheory = phase === "theory";
	const isPraxis = phase === "rehearsal";
	if (isPraxis) {
		return (
			<PracticeCompletionCard
				durationMinutes={durationMinutes}
				correctCount={correctCount}
				attemptCount={attemptCount}
				onRepeat={onContinueLearning}
				onAnalysis={onPrimary}
				isBusy={isBusy}
			/>
		);
	}

	const title = isTheory ? "Theorie abgeschlossen" : "Übung abgeschlossen";
	const description = isTheory
		? "Du hast die Theorieeinheit erfolgreich beendet. Du kannst die Themen jetzt noch einmal wiederholen oder direkt zum nächsten Schritt wechseln."
		: "Du hast alle Aufgaben bearbeitet. Wiederhole die Themen oder gehe zum nächsten Schritt.";
	const Icon = isTheory ? BookOpen : Pencil;
	const iconClassName = isTheory ? "bg-theorie-subtle" : "bg-ueben-subtle";
	const iconColor = isTheory
		? DAYOVA_DESIGN_SYSTEM.colors.theorie
		: DAYOVA_DESIGN_SYSTEM.colors.ueben;

	return (
		<View className="flex-1 justify-center">
			<Surface className="rounded-[32px] px-6 py-12" variant="flat">
				<View className="items-center">
					<View
						className={cn(
							"mb-16 h-32 w-32 items-center justify-center rounded-[32px]",
							iconClassName,
						)}
					>
						<Icon size={64} color={iconColor} strokeWidth={2.1} />
					</View>
					<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
						{title}
					</Text>
					<Text className="mt-4 text-center font-poppins text-body-2 text-secondary-text">
						{description}
					</Text>
				</View>
				<ActionRow
					secondaryLabel="10 Min. weiterlernen"
					primaryLabel={isTheory ? "Abschließen" : "Analyse ansehen"}
					onSecondary={onContinueLearning}
					onPrimary={onPrimary}
					isBusy={isBusy}
				/>
			</Surface>
		</View>
	);
}

function ChoiceList({
	item,
	selectedChoiceId,
	onSelect,
	disabled,
}: {
	item: SessionContentItem;
	selectedChoiceId: string | null;
	onSelect: (choiceId: string) => void;
	disabled: boolean;
}) {
	return (
		<View className="mt-5 gap-2">
			{item.choices.map((choice, index) => {
				const selected = selectedChoiceId === choice.id;
				const choiceLabel = String.fromCharCode(65 + index);
				return (
					<TouchableOpacity
						key={choice.id}
						accessibilityRole="radio"
						accessibilityState={{ selected, disabled }}
						activeOpacity={0.86}
						disabled={disabled}
						onPress={() => onSelect(choice.id)}
						className={cn(
							"min-h-14 flex-row items-center gap-3 rounded-[24px] border-border border-hairline bg-card px-4 py-3 shadow-black/5 shadow-sm",
							selected && "border-primary bg-system-subtle",
						)}
					>
						<View
							className={cn(
								"h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-light-2",
								selected && "bg-primary",
							)}
						>
							<Text
								className={cn(
									"font-poppins font-semibold text-body-4 text-secondary-text",
									selected && "text-white",
								)}
							>
								{choiceLabel}
							</Text>
						</View>
						<Text
							className={cn(
								"flex-1 font-poppins text-body-3 text-text",
								selected && "text-primary",
							)}
						>
							{choice.text}
						</Text>
						<View
							className={cn(
								"h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary-text/50",
								selected && "border-primary bg-primary",
							)}
						>
							{selected ? (
								<Check
									size={14}
									color={DAYOVA_DESIGN_SYSTEM.colors.light1}
									strokeWidth={2.8}
								/>
							) : null}
						</View>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

function TextAnswer({
	value,
	onChange,
	placeholder,
	editable,
	fillAvailableSpace = false,
	autoFocus,
	inputRef,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	editable: boolean;
	fillAvailableSpace?: boolean;
	autoFocus?: boolean;
	inputRef?: React.Ref<TextInput>;
}) {
	return (
		<Textarea
			ref={inputRef}
			autoFocus={(autoFocus ?? fillAvailableSpace) && editable}
			accessibilityLabel="Antwort"
			className={cn(
				"mt-4 px-0 py-2",
				fillAvailableSpace ? "min-h-[180px] flex-1" : "min-h-40",
			)}
			editable={editable}
			value={value}
			onChangeText={onChange}
			placeholder={placeholder}
		/>
	);
}

function VoiceAnswer({
	value,
	onChange,
	editable,
	isRecognizing,
	speechErrorMessage,
	speechCaptureUnavailableMessage,
	onToggleRecording,
}: {
	value: string;
	onChange: (value: string) => void;
	editable: boolean;
	isRecognizing: boolean;
	speechErrorMessage: string | null;
	speechCaptureUnavailableMessage: string | null;
	onToggleRecording: () => void;
}) {
	const isSpeechCaptureUnavailable = Boolean(speechCaptureUnavailableMessage);
	const [isEditingTranscript, setIsEditingTranscript] = useState(
		isSpeechCaptureUnavailable,
	);
	const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
	const transcriptInputRef = useRef<TextInput>(null);
	const hasTranscript = Boolean(value.trim());
	const hasLongTranscript = value.trim().length > 180;
	const liveTranscript = value.trim()
		? value.trim().length > 220
			? `…${value
					.trim()
					.slice(-220)
					.replace(/^\S+\s*/, "")}`
			: value.trim()
		: "Ich höre zu …";

	const startEditingTranscript = () => {
		setIsEditingTranscript(true);
		requestAnimationFrame(() => transcriptInputRef.current?.focus());
	};

	const handleVoiceCardPress = () => {
		if (isSpeechCaptureUnavailable) {
			startEditingTranscript();
			return;
		}
		if (!isRecognizing) {
			setIsEditingTranscript(false);
			setIsTranscriptExpanded(false);
		}
		onToggleRecording();
	};

	return (
		<View>
			<TouchableOpacity
				accessibilityRole="button"
				accessibilityState={{ disabled: !editable, busy: isRecognizing }}
				activeOpacity={0.86}
				disabled={!editable}
				onPress={handleVoiceCardPress}
				className={cn(
					"mt-6 min-h-[232px] items-center justify-center rounded-[32px] bg-card px-5",
					!editable && "opacity-60",
				)}
			>
				<View className="h-40 w-40 items-center justify-center rounded-full bg-primary/10">
					<View className="h-32 w-32 items-center justify-center rounded-full bg-primary/20">
						<View
							className={cn(
								"h-24 w-24 items-center justify-center rounded-full",
								isRecognizing ? "bg-wrong" : "bg-primary",
							)}
						>
							<Mic
								size={34}
								color={DAYOVA_DESIGN_SYSTEM.colors.light1}
								strokeWidth={2.1}
							/>
						</View>
					</View>
				</View>
				<Text
					className={cn(
						"mt-5 font-poppins font-semibold text-body-4",
						isRecognizing ? "text-wrong" : "text-primary",
					)}
				>
					{isRecognizing
						? "Aufnahme stoppen"
						: isSpeechCaptureUnavailable
							? "Antwort eintippen"
							: "Antwort einsprechen"}
				</Text>
			</TouchableOpacity>
			<Text
				selectable
				className="mt-3 px-1 font-poppins text-body-4 text-secondary-text"
			>
				{isRecognizing
					? "Sprich einfach weiter. Du siehst hier nur die letzten erkannten Wörter."
					: isSpeechCaptureUnavailable
						? speechCaptureUnavailableMessage
						: "Nach der Aufnahme kannst du deine Antwort kurz prüfen oder bearbeiten."}
			</Text>

			{isRecognizing ? (
				<Animated.View
					key="live-transcript"
					entering={FadeIn.duration(160)}
					exiting={FadeOut.duration(120)}
				>
					<Surface className="mt-5 rounded-[24px] px-4 py-4" variant="flat">
						<Text className="font-poppins font-semibold text-body-4 text-primary">
							Live-Transkript
						</Text>
						<Text
							selectable
							className="mt-2 font-poppins text-body-3 text-text"
							numberOfLines={3}
						>
							{liveTranscript}
						</Text>
					</Surface>
				</Animated.View>
			) : isEditingTranscript ? (
				<Animated.View
					key="transcript-editor"
					entering={FadeIn.duration(160)}
					exiting={FadeOut.duration(120)}
					className="mt-5"
				>
					<View className="flex-row items-center justify-between gap-4">
						<Text className="font-poppins font-semibold text-body-4 text-text">
							Deine Antwort
						</Text>
						{hasTranscript && !isSpeechCaptureUnavailable ? (
							<TouchableOpacity
								accessibilityRole="button"
								onPress={() => setIsEditingTranscript(false)}
								className="min-h-11 justify-center px-2"
							>
								<Text className="font-poppins font-semibold text-body-4 text-primary">
									Fertig
								</Text>
							</TouchableOpacity>
						) : null}
					</View>
					<TextAnswer
						inputRef={transcriptInputRef}
						value={value}
						onChange={onChange}
						placeholder="Schreibe hier deine Antwort."
						editable={editable}
						autoFocus={isSpeechCaptureUnavailable}
					/>
				</Animated.View>
			) : hasTranscript ? (
				<Animated.View
					key="transcript-preview"
					entering={FadeIn.duration(160)}
					exiting={FadeOut.duration(120)}
				>
					<Surface className="mt-5 rounded-[24px] px-4 py-4" variant="flat">
						<View className="flex-row items-center justify-between gap-4">
							<Text className="font-poppins font-semibold text-body-4 text-text">
								Deine Antwort
							</Text>
							<TouchableOpacity
								accessibilityRole="button"
								disabled={!editable}
								onPress={startEditingTranscript}
								className="min-h-11 justify-center px-2"
							>
								<Text className="font-poppins font-semibold text-body-4 text-primary">
									Bearbeiten
								</Text>
							</TouchableOpacity>
						</View>
						<Text
							selectable
							className="mt-1 font-poppins text-body-3 text-text"
							numberOfLines={isTranscriptExpanded ? undefined : 4}
						>
							{value.trim()}
						</Text>
						{hasLongTranscript ? (
							<TouchableOpacity
								accessibilityRole="button"
								onPress={() => setIsTranscriptExpanded((expanded) => !expanded)}
								className="min-h-11 justify-center self-start pt-1"
							>
								<Text className="font-poppins font-semibold text-body-4 text-primary">
									{isTranscriptExpanded ? "Weniger anzeigen" : "Alles anzeigen"}
								</Text>
							</TouchableOpacity>
						) : null}
					</Surface>
				</Animated.View>
			) : null}
			{speechErrorMessage ? (
				<Text
					selectable
					accessibilityLiveRegion="polite"
					className="mt-3 px-1 font-poppins text-body-4 text-destructive"
				>
					{speechErrorMessage}
				</Text>
			) : null}
		</View>
	);
}

function AnalysisView({
	content,
	onContinueLearning,
	onDone,
	isBusy,
}: {
	content: LearningSessionContentSnapshot;
	onContinueLearning: () => void;
	onDone: () => void;
	isBusy: boolean;
}) {
	const analysis = content.analysis;

	return (
		<View className="flex-1">
			{analysis ? (
				<View className="mt-10">
					<Surface className="rounded-[32px] px-5 py-6" variant="flat">
						<TagPill label="Stärken" icon="evaluation" />
						{analysis.strengths.map((strength) => (
							<Text
								key={strength}
								className="mt-6 font-poppins text-body-2 text-text"
							>
								{"\u2022"} {strength}
							</Text>
						))}
					</Surface>
					<View className="mx-8 my-8 h-px bg-border" />
					<Surface className="rounded-[32px] px-5 py-6" variant="flat">
						<TagPill label="Lücken" icon="answer" />
						{analysis.gaps.map((gap) => (
							<Text
								key={gap}
								className="mt-6 font-poppins text-body-2 text-text"
							>
								{"\u2022"} {gap}
							</Text>
						))}
					</Surface>
					<View className="mx-8 my-8 h-px bg-border" />
					<Surface className="rounded-[32px] px-5 py-6" variant="flat">
						<TagPill label="Empfehlungen" icon="question" />
						<Text className="mt-8 font-poppins font-semibold text-body-2 text-text">
							{analysis.recommendation}
						</Text>
					</Surface>
				</View>
			) : (
				<View className="items-center py-16">
					<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
				</View>
			)}
			<ActionRow
				secondaryLabel="10 Min. weiterlernen"
				primaryLabel="Abschließen"
				onSecondary={onContinueLearning}
				onPrimary={onDone}
				isBusy={isBusy}
			/>
		</View>
	);
}

export default function LearningSessionContentScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{
		planId?: string;
		sessionId?: string;
	}>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const sessionId = params.sessionId as Id<"learningPlanSessions"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const ensureSessionContent = useMutation(
		api.learningSessionContent.ensureSessionContent,
	);
	const submitAnswer = useMutation(api.learningSessionContent.submitAnswer);
	const finishSessionContent = useMutation(
		api.learningSessionContent.finishSessionContent,
	);
	const extendSessionContent = useMutation(
		api.learningSessionContent.extendSessionContent,
	);
	const startSession = useMutation(api.learningPlans.startSession);
	const recordSessionOutcome = useMutation(
		api.learningPlans.recordSessionOutcome,
	);
	const { capture } = useValidationAnalytics();
	const { colors } = useDayovaTheme();

	const [currentIndex, setCurrentIndex] = useState(0);
	const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
	const [answerText, setAnswerText] = useState("");
	const [localAttempt, setLocalAttempt] = useState<SessionAnswerAttempt | null>(
		null,
	);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isRecognizing, setIsRecognizing] = useState(false);
	const [speechErrorMessage, setSpeechErrorMessage] = useState<string | null>(
		null,
	);
	const [showAnalysis, setShowAnalysis] = useState(false);
	const [completionPhase, setCompletionPhase] = useState<
		LearningSessionContentSnapshot["session"]["phase"] | null
	>(null);
	const [repeatingItemId, setRepeatingItemId] = useState<string | null>(null);
	const [retryStartedAt, setRetryStartedAt] = useState<number | null>(null);
	const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
	const remainingSecondsRef = useRef<number | null>(null);
	const [isContinuation, setIsContinuation] = useState(false);
	const didEnsureRef = useRef(false);
	const didAutoFinishRef = useRef(false);
	const didStartTrackingRef = useRef(false);
	const didRecordOutcomeRef = useRef(false);
	const activeStudySecondsRef = useRef(0);
	const activeStudyStartedAtRef = useRef<number | null>(null);
	const isStudyInteractionActiveRef = useRef(false);
	const appStateRef = useRef(AppState.currentState);
	const contentScrollRef = useRef<ScrollView>(null);
	const startSessionPromiseRef = useRef<ReturnType<typeof startSession> | null>(
		null,
	);

	const recognizerCallbacks = useMemo<RecognizerCallbacks>(
		() => ({
			onReadyForSpeech: () => {
				setIsRecognizing(true);
				setSpeechErrorMessage(null);
			},
			onRecordingStopped: () => setIsRecognizing(false),
			onResult: (resultBatches: string[]) => {
				const transcript = resultBatches.join(" ").replace(/\s+/g, " ").trim();
				if (transcript) setAnswerText(transcript);
			},
			onError: (error: SpeechRecognitionError) => {
				setIsRecognizing(false);
				setSpeechErrorMessage(getSpeechRecognitionErrorMessage(error));
			},
			onPermissionDenied: () => {
				setIsRecognizing(false);
				setSpeechErrorMessage(
					getSpeechPermissionMessage(PermissionStatus.DENIED),
				);
			},
		}),
		[],
	);
	const speechRecognizer = useOptionalSpeechRecognizer(recognizerCallbacks);
	const speechCaptureUnavailableMessage = isIosSimulator
		? iosSimulatorSpeechMessage
		: speechRecognizer.isAvailable
			? null
			: nativeSpeechUnavailableMessage;

	const content = (useQuery(
		api.learningSessionContent.getSessionContent,
		user && isConvexAuthenticated && sessionId ? { sessionId } : "skip",
	) ?? null) as LearningSessionContentSnapshot | null;

	const sessionItems = content
		? getLearningSessionItems(
				content.items,
				content.session.phase,
				content.session.compositionVariant,
			)
		: [];
	const theoryItems = sessionItems.filter((item) => item.kind === "learnCard");
	const currentItem = sessionItems[currentIndex] ?? null;
	const shouldTrackActiveStudy = Boolean(
		currentItem && !showAnalysis && !completionPhase,
	);
	const isPraxisSession = content?.session.phase === "rehearsal";
	const persistedAttempt = useMemo(() => {
		if (!currentItem || !content) return null;
		if (currentItem.id === repeatingItemId) return null;
		const attempt =
			content.attempts.find((attempt) => attempt.itemId === currentItem.id) ??
			null;
		if (!attempt) return null;
		if (retryStartedAt !== null && attempt.createdAt < retryStartedAt)
			return null;
		return attempt;
	}, [content, currentItem, repeatingItemId, retryStartedAt]);
	const visibleAttempt =
		!isPraxisSession &&
		localAttempt &&
		currentItem &&
		localAttempt.itemId === currentItem.id
			? localAttempt
			: isPraxisSession
				? null
				: persistedAttempt;
	const currentRunAttempts = useMemo(() => {
		const attempts =
			content?.attempts.filter(
				(attempt) =>
					retryStartedAt === null || attempt.createdAt >= retryStartedAt,
			) ?? [];
		if (
			!localAttempt ||
			(retryStartedAt !== null && localAttempt.createdAt < retryStartedAt) ||
			attempts.some((attempt) => attempt.id === localAttempt.id)
		) {
			return attempts;
		}
		return [...attempts, localAttempt];
	}, [content?.attempts, localAttempt, retryStartedAt]);
	const currentRunCorrectCount = currentRunAttempts.filter(
		(attempt) => attempt.rating === "correct",
	).length;

	const goBack = useCallback(() => {
		void Speech.stop().catch(() => undefined);
		if (planId) {
			router.replace(`/learning-plans/${planId}` as const);
			return true;
		}
		goBackOrReplace(router, "/learning-plans");
		return true;
	}, [planId, router]);

	useBackIntent(Boolean(planId), goBack);

	const ensureSessionStarted = useCallback(() => {
		if (!sessionId) {
			return Promise.reject(new Error("Lernblock nicht gefunden."));
		}
		if (!startSessionPromiseRef.current) {
			didStartTrackingRef.current = true;
			startSessionPromiseRef.current = startSession({ sessionId })
				.then((result) => {
					void capture(
						"study_slot_started",
						definedAnalyticsProperties({
							...learningSessionAnalyticsProperties(result),
							started_at: result.startedAt,
						}),
					);
					return result;
				})
				.catch((error: unknown) => {
					didStartTrackingRef.current = false;
					startSessionPromiseRef.current = null;
					throw error;
				});
		}

		return startSessionPromiseRef.current;
	}, [capture, sessionId, startSession]);

	const getActiveStudySeconds = useCallback(() => {
		const now = Date.now();
		const activeStartedAt = activeStudyStartedAtRef.current;
		if (activeStartedAt !== null) {
			activeStudySecondsRef.current +=
				Math.max(0, now - activeStartedAt) / 1000;
			activeStudyStartedAtRef.current =
				isStudyInteractionActiveRef.current && appStateRef.current === "active"
					? now
					: null;
		}
		return Math.floor(activeStudySecondsRef.current);
	}, []);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextState) => {
			const now = Date.now();
			appStateRef.current = nextState;
			if (nextState === "active" && isStudyInteractionActiveRef.current) {
				activeStudyStartedAtRef.current = now;
				return;
			}

			const activeStartedAt = activeStudyStartedAtRef.current;
			if (activeStartedAt !== null) {
				activeStudySecondsRef.current +=
					Math.max(0, now - activeStartedAt) / 1000;
				activeStudyStartedAtRef.current = null;
			}
		});

		return () => subscription.remove();
	}, []);

	useEffect(() => {
		isStudyInteractionActiveRef.current = shouldTrackActiveStudy;
		const now = Date.now();
		if (shouldTrackActiveStudy && appStateRef.current === "active") {
			activeStudyStartedAtRef.current ??= now;
			return;
		}

		const activeStartedAt = activeStudyStartedAtRef.current;
		if (activeStartedAt !== null) {
			activeStudySecondsRef.current +=
				Math.max(0, now - activeStartedAt) / 1000;
			activeStudyStartedAtRef.current = null;
		}
	}, [shouldTrackActiveStudy]);

	useEffect(() => {
		if (!sessionId || !user || !isConvexAuthenticated || didEnsureRef.current)
			return;

		didEnsureRef.current = true;
		void ensureSessionContent({ sessionId }).catch((error: unknown) => {
			didEnsureRef.current = false;
			setErrorMessage(
				getErrorMessage(
					error,
					"Der Lernblock konnte nicht vorbereitet werden.",
				),
			);
		});
	}, [ensureSessionContent, isConvexAuthenticated, sessionId, user]);

	useEffect(() => {
		if (
			!sessionId ||
			!content ||
			content.session.executionStatus !== "notStarted" ||
			didStartTrackingRef.current
		)
			return;

		void ensureSessionStarted().catch((error: unknown) => {
			logDiagnosticError("Failed to start learning session tracking.", error, {
				source: "learningSession.startSession",
				level: "warn",
			});
		});
	}, [content, ensureSessionStarted, sessionId]);

	const timerDurationSeconds = getLearningSessionTimerDurationSeconds({
		phase: content?.session.phase,
		durationMinutes: content?.session.durationMinutes,
		hasCurrentItem: Boolean(currentItem),
		isContinuation,
	});

	useEffect(() => {
		if (!timerDurationSeconds || showAnalysis || completionPhase) {
			remainingSecondsRef.current = null;
			return undefined;
		}

		const timer = setInterval(() => {
			const currentSeconds =
				remainingSecondsRef.current ?? timerDurationSeconds;
			const nextSeconds = Math.max(0, currentSeconds - 1);
			remainingSecondsRef.current = nextSeconds;
			setRemainingSeconds(nextSeconds);
		}, 1000);

		return () => clearInterval(timer);
	}, [completionPhase, showAnalysis, timerDurationSeconds]);

	const displayedRemainingSeconds =
		timerDurationSeconds !== null && !showAnalysis && !completionPhase
			? (remainingSeconds ?? timerDurationSeconds)
			: null;

	useEffect(() => {
		if (
			!sessionId ||
			displayedRemainingSeconds !== 0 ||
			didAutoFinishRef.current
		)
			return;

		didAutoFinishRef.current = true;
		queueMicrotask(() => {
			if (!isContinuation && content?.session.phase !== "rehearsal") {
				setCompletionPhase(
					getLearningSessionCompletionPhase(
						content?.session.phase ?? "practice",
						content?.session.compositionVariant ?? "control",
					),
				);
				return;
			}

			setIsContinuation(false);
			setCompletionPhase(null);
			setShowAnalysis(true);
			void finishSessionContent({ sessionId }).catch((error: unknown) => {
				setErrorMessage(
					getErrorMessage(
						error,
						"Die Wissensanalyse konnte nicht erstellt werden.",
					),
				);
			});
		});
	}, [
		content?.session.compositionVariant,
		content?.session.phase,
		displayedRemainingSeconds,
		finishSessionContent,
		isContinuation,
		sessionId,
	]);

	const resetItemState = () => {
		if (isRecognizing) speechRecognizer.stopListening();
		setSelectedChoiceId(null);
		setAnswerText("");
		setLocalAttempt(null);
		setRepeatingItemId(null);
		setSpeechErrorMessage(null);
	};

	const repeatCurrentQuestion = () => {
		if (!currentItem || isBusy) return;
		resetItemState();
		setRepeatingItemId(currentItem.id);
		setErrorMessage(null);
		contentScrollRef.current?.scrollTo({ y: 0, animated: true });
	};

	const finishAndShowAnalysis = async () => {
		if (!sessionId || isBusy) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			await finishSessionContent({ sessionId });
			setCompletionPhase(null);
			setShowAnalysis(true);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Die Wissensanalyse konnte nicht erstellt werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const recordCompletedOutcome = async () => {
		if (!sessionId || didRecordOutcomeRef.current) return null;
		if (content?.session.executionStatus === "completed") {
			didRecordOutcomeRef.current = true;
			return null;
		}
		if (content?.session.executionStatus === "notStarted") {
			await ensureSessionStarted();
		}

		const activeStudySeconds = getActiveStudySeconds();
		const qualifiedCompletion = isQualifiedSessionCompletion(
			content?.session.durationMinutes ?? 0,
			activeStudySeconds,
		);
		const completed = await recordSessionOutcome({
			sessionId,
			outcome: "completed",
			activeStudySeconds,
		});
		didRecordOutcomeRef.current = true;
		const properties = definedAnalyticsProperties({
			...learningSessionAnalyticsProperties(completed),
			outcome: "completed",
			outcome_at: completed.outcomeAt,
			qualified_completion: qualifiedCompletion,
		});
		void capture("study_slot_completed", properties);
		if (qualifiedCompletion) {
			void capture("qualified_study_slot_completed", properties);
		}
		if (completed.phase === "rehearsal") {
			void capture("generalprobe_completed", properties);
		}
		return completed;
	};

	const completeAndLeave = async () => {
		if (!sessionId || isBusy) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			await recordCompletedOutcome();
			goBack();
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Der Lernblock konnte nicht abgeschlossen werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const startContinueLearning = async () => {
		if (!content || isBusy) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			await recordCompletedOutcome();
			const extension = await extendSessionContent({
				sessionId: content.session.id,
				durationMinutes: CONTINUE_LEARNING_MINUTES,
			});
			resetItemState();
			setRetryStartedAt(Date.now());
			setCurrentIndex(extension.firstNewItemIndex);
			setCompletionPhase(null);
			setShowAnalysis(false);
			setIsContinuation(true);
			didAutoFinishRef.current = false;
			void capture(
				"continue_learning_started",
				definedAnalyticsProperties({
					learning_plan_id: content.session.learningPlanId,
					learning_plan_session_id: content.session.id,
					session_composition_variant: content.session.compositionVariant,
					continue_minutes: CONTINUE_LEARNING_MINUTES,
				}),
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Das Weiterlernen konnte nicht gestartet werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const continueTheory = () => {
		if (!content || isBusy) return;
		runTheoryTopicPrimaryAction({
			currentIndex,
			total: sessionItems.length,
			onAdvance: (nextIndex) => {
				setErrorMessage(null);
				setCurrentIndex(nextIndex);
			},
			onComplete: () => {
				setCompletionPhase(
					getLearningSessionCompletionPhase(
						content.session.phase,
						content.session.compositionVariant,
					),
				);
			},
		});
	};

	const showPreviousTheoryTopic = () => {
		if (isBusy || currentIndex === 0) return;
		setErrorMessage(null);
		setCurrentIndex((value) => Math.max(0, value - 1));
	};

	const buildSpeechRecognitionConfig =
		useCallback((): SpeechRecognitionConfig => {
			const contextualStrings = Array.from(
				new Set(
					[
						content?.plan.subject,
						content?.plan.topicDescription,
						content?.session.goal,
						currentItem?.prompt,
						currentItem?.idealAnswer,
					]
						.map((value) => value?.trim())
						.filter((value): value is string => Boolean(value)),
				),
			).slice(0, 100);

			return {
				locale: "de-DE",
				contextualStrings,
				autoFinishRecognitionMs: 8000,
				autoFinishProgressIntervalMs: 1000,
				resetAutoFinishVoiceSensitivity: 0.4,
				startHapticFeedbackStyle: "medium",
				stopHapticFeedbackStyle: "medium",
				iosAddPunctuation: true,
				iosPreset: "general",
			};
		}, [content, currentItem]);

	const toggleVoiceRecording = async () => {
		if (!content || !currentItem || currentItem.kind !== "voice") return;
		if (visibleAttempt || isBusy) return;

		setErrorMessage(null);
		setSpeechErrorMessage(null);

		if (speechCaptureUnavailableMessage) {
			setSpeechErrorMessage(speechCaptureUnavailableMessage);
			return;
		}

		if (isRecognizing || speechRecognizer.getIsActive()) {
			speechRecognizer.stopListening();
			return;
		}

		try {
			if (Platform.OS === "ios") {
				const supportedLocales = speechRecognizer.getSupportedLocalesIOS();
				const supportsGerman =
					supportedLocales.length === 0 ||
					supportedLocales.some(
						(locale) => locale.replace("_", "-").toLowerCase() === "de-de",
					);
				if (!supportsGerman) {
					setSpeechErrorMessage(
						"Spracherkennung ist auf diesem Gerät für Deutsch gerade nicht verfügbar. Du kannst die Antwort als Text eintragen.",
					);
					return;
				}
			}

			const speechConfig = buildSpeechRecognitionConfig();
			await speechRecognizer.prewarm(speechConfig, { requestPermission: true });

			const permissionStatus = speechRecognizer.getPermissions();
			if (permissionStatus !== PermissionStatus.GRANTED) {
				setSpeechErrorMessage(getSpeechPermissionMessage(permissionStatus));
				return;
			}

			speechRecognizer.startListening(speechConfig);
		} catch {
			setIsRecognizing(false);
			setSpeechErrorMessage(
				"Die Spracherkennung konnte nicht gestartet werden. Du kannst die Antwort als Text eintragen.",
			);
		}
	};

	const submitCurrentAnswer = async (submitAsUnknown = false) => {
		if (!currentItem || isBusy) return;

		if (isRecognizing) speechRecognizer.stopListening();
		setIsBusy(true);
		setErrorMessage(null);
		try {
			const fallbackAnswer = "Weiß ich nicht";
			const writtenAnswer = submitAsUnknown
				? fallbackAnswer
				: answerText.trim();
			const attempt = await submitAnswer({
				itemId: currentItem.id,
				selectedChoiceId:
					currentItem.kind === "multipleChoice"
						? submitAsUnknown
							? "unknown"
							: (selectedChoiceId ?? undefined)
						: undefined,
				answerText: currentItem.kind === "written" ? writtenAnswer : undefined,
				transcript: currentItem.kind === "voice" ? writtenAnswer : undefined,
			});
			if (content?.session.phase === "rehearsal") {
				resetItemState();
				if (currentIndex < content.items.length - 1) {
					setCurrentIndex((value) => value + 1);
					return;
				}
				setCompletionPhase("rehearsal");
				return;
			}
			setLocalAttempt(attempt as SessionAnswerAttempt);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Die Antwort konnte nicht gespeichert werden."),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const continueTask = async () => {
		if (!content || isBusy) return;
		if (currentIndex < sessionItems.length - 1) {
			resetItemState();
			setCurrentIndex((value) => value + 1);
			return;
		}
		setCompletionPhase(
			getLearningSessionCompletionPhase(
				content.session.phase,
				content.session.compositionVariant,
			),
		);
	};

	const isAnswerReady =
		currentItem?.kind === "multipleChoice"
			? Boolean(selectedChoiceId)
			: Boolean(answerText.trim());

	const title = showAnalysis
		? "Wissensanalyse"
		: completionPhase
			? completionPhase === "theory"
				? "Theorie"
				: phaseTitle(completionPhase)
			: content
				? phaseTitle(currentItem?.phase ?? content.session.phase)
				: "Lernblock";
	const showQuestionActions = Boolean(
		content &&
			currentItem &&
			!showAnalysis &&
			!completionPhase &&
			!visibleAttempt,
	);
	const showFeedbackAction = Boolean(
		visibleAttempt && !showAnalysis && !completionPhase,
	);

	if (
		content?.session.phase === "theory" &&
		currentItem?.kind === "learnCard" &&
		!showAnalysis &&
		!completionPhase
	) {
		return (
			<View className="flex-1 bg-background">
				<Stack.Screen
					options={{
						gestureEnabled: true,
						headerShown: true,
						title: "Theorie",
						headerTitleAlign: "center",
						headerShadowVisible: false,
						// React Navigation's native header exposes its theme only through style objects.
						headerStyle: { backgroundColor: colors.background },
						headerTintColor: colors.text,
						headerTitleStyle: {
							fontFamily: "Poppins",
							fontSize: 16,
							fontWeight: "600",
						},
						headerLeft: () => (
							<BackButton
								accessibilityHint="Kehrt zum Lernplan zurück."
								onPress={goBack}
								className="h-11 min-h-11 w-11 min-w-11"
							/>
						),
						headerRight: () =>
							displayedRemainingSeconds !== null ? (
								<Text
									accessible
									accessibilityLabel={`Verbleibende Zeit: ${formatRemainingTime(displayedRemainingSeconds)}`}
									className="font-poppins font-semibold text-body-3 text-primary"
									style={{ fontVariant: ["tabular-nums"] }}
								>
									{formatRemainingTime(displayedRemainingSeconds)}
								</Text>
							) : null,
					}}
				/>
				<ThemedStatusBar />
				<TheoryTopicPage
					key={currentItem.id}
					item={currentItem}
					currentIndex={currentIndex}
					total={theoryItems.length}
					isCompleting={isBusy}
					onPrevious={showPreviousTheoryTopic}
					onNext={continueTheory}
				/>
				{errorMessage ? (
					<View className="absolute right-6 bottom-28 left-6 rounded-[24px] bg-wrong-subtle px-4 py-3">
						<Text
							selectable
							accessibilityLiveRegion="polite"
							className="font-poppins text-body-4 text-wrong"
						>
							{errorMessage}
						</Text>
					</View>
				) : null}
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ThemedStatusBar />
			<View
				className="px-8"
				style={{ paddingTop: Math.max(insets.top + 8, 24) }}
			>
				<ScreenHeader
					title={title}
					onBack={goBack}
					className="mb-0"
					titleClassName="px-24 text-center font-poppins font-semibold text-body-1 text-text"
					right={
						displayedRemainingSeconds !== null &&
						!showAnalysis &&
						!completionPhase ? (
							<View
								accessible
								accessibilityLabel={`Verbleibende Zeit: ${formatRemainingTime(displayedRemainingSeconds)}`}
								className="min-h-12 min-w-[92px] flex-row items-center justify-center gap-2 rounded-full border-hairline border-praxis/20 bg-praxis-subtle px-4 shadow-black/5 shadow-sm"
							>
								<Timer
									size={18}
									color={DAYOVA_DESIGN_SYSTEM.colors.praxis}
									strokeWidth={2.2}
								/>
								<Text
									className="font-poppins font-semibold text-body-3 text-praxis"
									numberOfLines={1}
									style={{ fontVariant: ["tabular-nums"] }}
								>
									{formatRemainingTime(displayedRemainingSeconds)}
								</Text>
							</View>
						) : null
					}
				/>
				{content &&
				currentItem &&
				!showAnalysis &&
				!completionPhase &&
				!visibleAttempt ? (
					<QuestionProgressBar
						currentIndex={currentIndex}
						total={sessionItems.length}
						className="mt-5 w-full"
					/>
				) : null}
			</View>
			<ScrollView
				ref={contentScrollRef}
				className="flex-1"
				bounces={
					currentItem?.kind !== "multipleChoice" || Boolean(visibleAttempt)
				}
				scrollEnabled={
					currentItem?.kind !== "multipleChoice" ||
					Boolean(visibleAttempt) ||
					showAnalysis ||
					Boolean(completionPhase)
				}
				automaticallyAdjustKeyboardInsets={
					currentItem?.kind === "written" || currentItem?.kind === "voice"
				}
				contentContainerStyle={{
					flexGrow: 1,
					paddingHorizontal: 32,
					paddingBottom:
						showQuestionActions || showFeedbackAction
							? 24
							: Math.max(insets.bottom + 28, 60),
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{!content || content.items.length === 0 ? (
					<View className="flex-1 items-center justify-center py-24">
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
					</View>
				) : showAnalysis ? (
					<AnalysisView
						content={content}
						onContinueLearning={() => void startContinueLearning()}
						onDone={completeAndLeave}
						isBusy={isBusy}
					/>
				) : completionPhase ? (
					<CompletionView
						phase={completionPhase}
						durationMinutes={content.session.durationMinutes}
						correctCount={currentRunCorrectCount}
						attemptCount={currentRunAttempts.length}
						onContinueLearning={() => void startContinueLearning()}
						onPrimary={
							completionPhase === "theory"
								? completeAndLeave
								: finishAndShowAnalysis
						}
						isBusy={isBusy}
					/>
				) : visibleAttempt ? (
					<FeedbackView attempt={visibleAttempt} />
				) : currentItem ? (
					<View className="flex-1 justify-between">
						<View className="flex-1 pt-8">
							<Text className="font-poppins font-semibold text-[17px] text-text leading-[26px]">
								{currentItem.prompt}
							</Text>

							{currentItem.kind === "multipleChoice" ? (
								<ChoiceList
									item={currentItem}
									selectedChoiceId={selectedChoiceId}
									onSelect={setSelectedChoiceId}
									disabled={isBusy}
								/>
							) : currentItem.kind === "voice" ? (
								<VoiceAnswer
									key={currentItem.id}
									value={answerText}
									onChange={setAnswerText}
									editable={!isBusy}
									isRecognizing={isRecognizing}
									speechErrorMessage={speechErrorMessage}
									speechCaptureUnavailableMessage={
										speechCaptureUnavailableMessage
									}
									onToggleRecording={toggleVoiceRecording}
								/>
							) : (
								<TextAnswer
									value={answerText}
									onChange={setAnswerText}
									placeholder="Schreibe hier deine Antwort."
									editable={!isBusy}
									fillAvailableSpace
								/>
							)}
						</View>

						{errorMessage ? (
							<Text className="mt-4 font-poppins text-body-4 text-destructive">
								{errorMessage}
							</Text>
						) : null}
					</View>
				) : null}

				{errorMessage && !currentItem ? (
					<Text className="mt-4 font-poppins text-body-4 text-destructive">
						{errorMessage}
					</Text>
				) : null}
			</ScrollView>
			{showQuestionActions && content ? (
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<View
						className="border-border border-t-hairline bg-background px-8 pt-4"
						style={{ paddingBottom: Math.max(insets.bottom, 16) }}
					>
						<ActionRow
							className="mt-0"
							secondaryLabel="Weiß ich nicht"
							primaryLabel={
								content.session.phase === "rehearsal"
									? currentIndex < content.items.length - 1
										? "Weiter"
										: "Abgeben"
									: "Beantworten"
							}
							onSecondary={() => void submitCurrentAnswer(true)}
							onPrimary={() => void submitCurrentAnswer()}
							primaryDisabled={isRecognizing || !isAnswerReady}
							isBusy={isBusy}
						/>
					</View>
				</KeyboardAvoidingView>
			) : showFeedbackAction ? (
				<View
					className="border-border border-t-hairline bg-background px-8 pt-4"
					style={{ paddingBottom: Math.max(insets.bottom, 16) }}
				>
					<ActionRow
						className="mt-0"
						secondaryLabel="Wiederholen"
						primaryLabel="Verstanden"
						onSecondary={repeatCurrentQuestion}
						onPrimary={continueTask}
						isBusy={isBusy}
					/>
				</View>
			) : null}
		</View>
	);
}
