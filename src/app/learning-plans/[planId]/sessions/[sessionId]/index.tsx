import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	AppState,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { QuestionProgressBar } from "~/components/question-progress-bar";
import { ScreenHeader } from "~/components/screen-header";
import { BackButton, Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import {
	Check,
	CircleAlert,
	ClipboardEdit,
	Pencil,
	Timer,
} from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { LearningSessionCompletion } from "~/features/learning-plans/learning-session-completion";
import { getLearningSessionAnalysisDestination } from "~/features/learning-plans/session-analysis-navigation";
import { learningSessionAnalyticsProperties } from "~/features/learning-plans/session-analytics";
import {
	CONTINUE_LEARNING_MINUTES,
	getLearningSessionCompletionPhase,
	getLearningSessionItems,
	getLearningSessionTimerDurationSeconds,
	getTheoryTopicPosition,
	isPairedTheoryQuestionItem,
} from "~/features/learning-plans/session-progress";
import { runTheoryTopicPrimaryAction } from "~/features/learning-plans/theory-topic";
import { TheoryTopicPage } from "~/features/learning-plans/theory-topic-page";
import type {
	LearningSessionContentSnapshot,
	SessionAnswerAttempt,
	SessionAnswerRating,
	SessionContentItem,
} from "~/features/learning-plans/types";
import { usePrepareSessionContent } from "~/features/learning-plans/use-prepare-session-content";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { logDiagnosticError } from "~/lib/diagnostics";
import { dismissToOrReplace, useBackIntent } from "~/lib/navigation";
import { triggerSuccessHaptic } from "~/lib/safe-haptics";
import { useDayovaTheme } from "~/lib/theme";
import { useValidationAnalytics } from "~/lib/use-validation-analytics";
import { cn } from "~/lib/utils";

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

const CURRENT_THEORY_CONTENT_VERSION = 2;

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
	busyLabel,
	className,
}: {
	secondaryLabel: string;
	primaryLabel: string;
	onSecondary: () => void;
	onPrimary: () => void;
	primaryDisabled?: boolean;
	isBusy?: boolean;
	busyLabel?: string;
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
					<View className="flex-row items-center justify-center gap-2">
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
						{busyLabel ? <Text>{busyLabel}</Text> : null}
					</View>
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
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	editable: boolean;
	fillAvailableSpace?: boolean;
	autoFocus?: boolean;
}) {
	return (
		<Textarea
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

export default function LearningSessionContentScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{
		planId?: string;
		sessionId?: string;
	}>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const sessionId = params.sessionId as Id<"learningPlanSessions"> | undefined;
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const submitAnswer = useMutation(api.learningSessionContent.submitAnswer);
	const evaluateWrittenAnswer = useAction(
		api.learningPlanAi.evaluateWrittenAnswer,
	);
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
	const prepareSessionContent = useAction(
		api.learningPlanAi.ensureSessionContent,
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
	const [completionPhase, setCompletionPhase] = useState<
		LearningSessionContentSnapshot["session"]["phase"] | null
	>(null);
	const [repeatingItemId, setRepeatingItemId] = useState<string | null>(null);
	const [retryStartedAt, setRetryStartedAt] = useState<number | null>(null);
	const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
	const remainingSecondsRef = useRef<number | null>(null);
	const [isContinuation, setIsContinuation] = useState(false);
	const didAutoFinishRef = useRef(false);
	const didStartTrackingRef = useRef(false);
	const didRecordOutcomeRef = useRef(false);
	const advancedPreTheoryQuestionItemIdRef = useRef<string | null>(null);
	const activeStudySecondsRef = useRef(0);
	const activeStudyStartedAtRef = useRef<number | null>(null);
	const isStudyInteractionActiveRef = useRef(false);
	const appStateRef = useRef(AppState.currentState);
	const contentScrollRef = useRef<ScrollView>(null);
	const startSessionPromiseRef = useRef<ReturnType<typeof startSession> | null>(
		null,
	);

	const content = (useQuery(
		api.learningSessionContent.getSessionContent,
		user && isConvexAuthenticated && sessionId ? { sessionId } : "skip",
	) ?? null) as LearningSessionContentSnapshot | null;
	const needsTheoryContentUpgrade = Boolean(
		content &&
			content.session.phase === "theory" &&
			content.session.executionStatus === "notStarted" &&
			(content.session.contentGenerationVersion ?? 0) <
				CURRENT_THEORY_CONTENT_VERSION,
	);

	const sessionItems = useMemo(
		() =>
			content && !needsTheoryContentUpgrade
				? getLearningSessionItems(
						content.items,
						content.session.phase,
						content.session.compositionVariant,
					)
				: [],
		[content, needsTheoryContentUpgrade],
	);
	const currentItem = sessionItems[currentIndex] ?? null;
	const theoryTopicPosition = getTheoryTopicPosition(
		sessionItems,
		currentIndex,
	);
	const shouldTrackActiveStudy = Boolean(currentItem && !completionPhase);
	const isPraxisSession = content?.session.phase === "rehearsal";
	const isDiagnosticSession = content?.session.sessionPurpose === "diagnostic";
	const isPairedTheoryQuestion = isPairedTheoryQuestionItem(currentItem);
	const isPreTheoryQuestion = isPairedTheoryQuestion;
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
		isPraxisSession || isPreTheoryQuestion
			? null
			: localAttempt && currentItem && localAttempt.itemId === currentItem.id
				? localAttempt
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
		if (planId) {
			dismissToOrReplace(router, `/learning-plans/${planId}` as const);
			return true;
		}
		dismissToOrReplace(router, "/learning-plans");
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
					void capture("study_slot_started", {
						...learningSessionAnalyticsProperties(result),
						started_at: result.startedAt,
					});
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

	usePrepareSessionContent({
		enabled: Boolean(user && isConvexAuthenticated),
		sessionId,
		onError: (error) => {
			setErrorMessage(
				getErrorMessage(
					error,
					"Der Lernblock konnte nicht vorbereitet werden.",
				),
			);
		},
	});

	const retrySessionPreparation = async () => {
		if (!sessionId || isBusy) return;
		setIsBusy(true);
		setErrorMessage(null);
		try {
			await prepareSessionContent({ sessionId });
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Der Lernblock konnte nicht vorbereitet werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	useEffect(() => {
		if (
			!sessionId ||
			!content ||
			content.items.length === 0 ||
			needsTheoryContentUpgrade ||
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
	}, [content, ensureSessionStarted, needsTheoryContentUpgrade, sessionId]);

	const timerDurationSeconds = getLearningSessionTimerDurationSeconds({
		phase: content?.session.phase,
		durationMinutes: content?.session.durationMinutes,
		hasCurrentItem: Boolean(currentItem),
		isContinuation,
	});

	useEffect(() => {
		if (!timerDurationSeconds || completionPhase) {
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
	}, [completionPhase, timerDurationSeconds]);

	const displayedRemainingSeconds =
		timerDurationSeconds !== null && !completionPhase
			? (remainingSeconds ?? timerDurationSeconds)
			: null;

	useEffect(() => {
		if (
			!sessionId ||
			displayedRemainingSeconds !== 0 ||
			isDiagnosticSession ||
			didAutoFinishRef.current
		)
			return;

		didAutoFinishRef.current = true;
		queueMicrotask(() => {
			setIsContinuation(false);
			setCompletionPhase(
				getLearningSessionCompletionPhase(
					content?.session.phase ?? "practice",
					content?.session.compositionVariant ?? "control",
				),
			);
		});
	}, [
		content?.session.compositionVariant,
		content?.session.phase,
		displayedRemainingSeconds,
		isDiagnosticSession,
		sessionId,
	]);

	const resetItemState = useCallback(() => {
		setSelectedChoiceId(null);
		setAnswerText("");
		setLocalAttempt(null);
		setRepeatingItemId(null);
	}, []);

	const advancePastCurrentItem = useCallback(() => {
		if (!content) return;
		resetItemState();
		if (currentIndex < sessionItems.length - 1) {
			setCurrentIndex((value) => value + 1);
			return;
		}
		setCompletionPhase(
			getLearningSessionCompletionPhase(
				content.session.phase,
				content.session.compositionVariant,
			),
		);
	}, [content, currentIndex, resetItemState, sessionItems.length]);

	useEffect(() => {
		if (
			!isPreTheoryQuestion ||
			!currentItem ||
			!persistedAttempt ||
			advancedPreTheoryQuestionItemIdRef.current === currentItem.id
		) {
			return;
		}
		advancedPreTheoryQuestionItemIdRef.current = currentItem.id;
		queueMicrotask(advancePastCurrentItem);
	}, [
		advancePastCurrentItem,
		currentItem,
		isPreTheoryQuestion,
		persistedAttempt,
	]);

	const repeatCurrentQuestion = () => {
		if (!currentItem || isBusy) return;
		resetItemState();
		setRepeatingItemId(currentItem.id);
		setErrorMessage(null);
		contentScrollRef.current?.scrollTo({ y: 0, animated: true });
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
		const completed = await recordSessionOutcome({
			sessionId,
			outcome: "completed",
			activeStudySeconds,
		});
		didRecordOutcomeRef.current = true;
		void capture("study_slot_completed", {
			...learningSessionAnalyticsProperties(completed),
			outcome_at: completed.outcomeAt,
		});
		return completed;
	};

	const completeAndLeave = async () => {
		if (!sessionId || isBusy) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			await finishSessionContent({ sessionId });
			const completed = await recordCompletedOutcome();
			const nextSessionId = completed?.rollingUpdate?.committedSessionId;
			if (nextSessionId) {
				void prepareSessionContent({ sessionId: nextSessionId }).catch(
					(error: unknown) => {
						logDiagnosticError(
							"Failed to prewarm the next learning session.",
							error,
							{
								source: "learningSession.prewarmNextSession",
								level: "warn",
							},
						);
					},
				);
			}
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

	const completeAndOpenAnalysis = async () => {
		if (!sessionId || isBusy) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			const completed = await recordCompletedOutcome();
			const nextSessionId = completed?.rollingUpdate?.committedSessionId;
			if (nextSessionId) {
				void prepareSessionContent({ sessionId: nextSessionId }).catch(
					(error: unknown) => {
						logDiagnosticError(
							"Failed to prewarm the next learning session.",
							error,
							{
								source: "learningSession.prewarmNextSession",
								level: "warn",
							},
						);
					},
				);
			}
			router.dismissTo(getLearningSessionAnalysisDestination(planId));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Die Analyse konnte nicht geöffnet werden."),
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
			setIsContinuation(true);
			didAutoFinishRef.current = false;
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
			currentIndex: theoryTopicPosition.topicIndex,
			total: theoryTopicPosition.total,
			onAdvance: () => {
				if (currentIndex >= sessionItems.length - 1) return;
				setErrorMessage(null);
				setCurrentIndex((value) => value + 1);
			},
			onComplete: () => {
				if (currentIndex < sessionItems.length - 1) {
					setErrorMessage(null);
					setCurrentIndex((value) => value + 1);
					return;
				}
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
		if (isBusy || theoryTopicPosition.previousSessionIndex === null) return;
		setErrorMessage(null);
		setCurrentIndex(theoryTopicPosition.previousSessionIndex);
	};

	const submitCurrentAnswer = async (submitAsUnknown = false) => {
		if (!currentItem || isBusy) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			const fallbackAnswer = "Weiß ich nicht";
			const writtenAnswer = submitAsUnknown
				? fallbackAnswer
				: answerText.trim();
			const attempt =
				currentItem.kind === "multipleChoice"
					? await submitAnswer({
							itemId: currentItem.id,
							selectedChoiceId: submitAsUnknown
								? "unknown"
								: (selectedChoiceId ?? undefined),
						})
					: await evaluateWrittenAnswer({
							itemId: currentItem.id,
							answerText: writtenAnswer,
						});
			if (attempt.rating === "correct" && !isPreTheoryQuestion) {
				void triggerSuccessHaptic({
					platform: process.env.EXPO_OS,
				});
			}
			if (content?.session.phase === "rehearsal") {
				resetItemState();
				if (currentIndex < content.items.length - 1) {
					setCurrentIndex((value) => value + 1);
					return;
				}
				setCompletionPhase("rehearsal");
				return;
			}
			if (isPreTheoryQuestion) {
				if (advancedPreTheoryQuestionItemIdRef.current !== currentItem.id) {
					advancedPreTheoryQuestionItemIdRef.current = currentItem.id;
					advancePastCurrentItem();
				}
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

	const continueTask = () => {
		if (!content || isBusy) return;
		advancePastCurrentItem();
	};

	const isAnswerReady =
		currentItem?.kind === "multipleChoice"
			? Boolean(selectedChoiceId)
			: Boolean(answerText.trim());
	const title = completionPhase
		? isDiagnosticSession
			? "Wissenscheck"
			: completionPhase === "theory"
				? "Theorie"
				: phaseTitle(completionPhase)
		: content
			? isDiagnosticSession
				? "Wissenscheck"
				: isPreTheoryQuestion
					? "Kurz-Check"
					: phaseTitle(currentItem?.phase ?? content.session.phase)
			: "Lernblock";
	const showQuestionActions = Boolean(
		content && currentItem && !completionPhase && !visibleAttempt,
	);
	const showFeedbackAction = Boolean(visibleAttempt && !completionPhase);

	if (
		content?.session.phase === "theory" &&
		currentItem?.kind === "learnCard" &&
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
					currentIndex={theoryTopicPosition.topicIndex}
					total={theoryTopicPosition.total}
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
			<Stack.Screen
				options={
					completionPhase
						? {
								gestureEnabled: true,
								headerShown: true,
								title,
								headerTitleAlign: "center",
								headerShadowVisible: false,
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
							}
						: {
								gestureEnabled: true,
								headerShown: false,
							}
				}
			/>
			<ThemedStatusBar />
			{!completionPhase ? (
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
							displayedRemainingSeconds !== null ? (
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
					{content && currentItem && !visibleAttempt ? (
						<QuestionProgressBar
							currentIndex={
								isPreTheoryQuestion
									? theoryTopicPosition.topicIndex
									: currentIndex
							}
							total={
								isPreTheoryQuestion
									? theoryTopicPosition.total
									: sessionItems.length
							}
							className="mt-5 w-full"
						/>
					) : null}
				</View>
			) : null}
			<ScrollView
				ref={contentScrollRef}
				className="flex-1"
				bounces={
					currentItem?.kind !== "multipleChoice" || Boolean(visibleAttempt)
				}
				scrollEnabled={
					currentItem?.kind !== "multipleChoice" ||
					Boolean(visibleAttempt) ||
					Boolean(completionPhase)
				}
				automaticallyAdjustKeyboardInsets={currentItem?.kind === "written"}
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
				{!content || content.items.length === 0 || needsTheoryContentUpgrade ? (
					<View className="flex-1 items-center justify-center px-4 py-24">
						<View className="h-14 w-14 items-center justify-center rounded-full bg-system-subtle">
							<ActivityIndicator
								accessibilityLabel="Lerninhalte werden vorbereitet"
								color={DAYOVA_DESIGN_SYSTEM.colors.primary}
							/>
						</View>
						<Text className="mt-6 text-center font-poppins font-semibold text-body-1 text-text">
							Dein Lernblock wird vorbereitet
						</Text>
						<Text className="mt-2 text-center font-poppins text-body-3 text-secondary-text">
							Dayova erstellt gerade passende Inhalte aus deinen Unterlagen. Du
							kannst zum Lernplan zurückgehen – die Vorbereitung läuft weiter.
						</Text>
						{errorMessage ? (
							<ErrorMessage className="mt-5">{errorMessage}</ErrorMessage>
						) : null}
						{errorMessage ||
						content?.session.contentGenerationStatus === "failed" ? (
							<Button
								className="mt-8"
								disabled={isBusy}
								onPress={retrySessionPreparation}
							>
								{isBusy ? (
									<ActivityIndicator
										color={DAYOVA_DESIGN_SYSTEM.colors.light1}
									/>
								) : (
									<Text>Erneut versuchen</Text>
								)}
							</Button>
						) : null}
						<Button className="mt-4" onPress={goBack} variant="neutral">
							<Text>Zurück zum Lernplan</Text>
						</Button>
					</View>
				) : completionPhase ? (
					<LearningSessionCompletion
						phase={completionPhase}
						isDiagnostic={isDiagnosticSession}
						durationMinutes={content.session.durationMinutes}
						correctCount={currentRunCorrectCount}
						attemptCount={currentRunAttempts.length}
						onContinueLearning={() => void startContinueLearning()}
						onPrimary={
							completionPhase === "theory"
								? completeAndLeave
								: completeAndOpenAnalysis
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
							) : (
								<TextAnswer
									value={answerText}
									onChange={setAnswerText}
									placeholder="Schreibe hier deine Antwort."
									editable={!isBusy}
									fillAvailableSpace
									autoFocus={!isPreTheoryQuestion}
								/>
							)}
						</View>

						{errorMessage ? (
							<ErrorMessage className="mt-4">{errorMessage}</ErrorMessage>
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
							secondaryLabel={
								isPreTheoryQuestion ? "Noch nicht" : "Weiß ich nicht"
							}
							primaryLabel={
								isPreTheoryQuestion
									? "Abgeben"
									: content.session.phase === "rehearsal"
										? currentIndex < content.items.length - 1
											? "Weiter"
											: "Abgeben"
										: "Beantworten"
							}
							onSecondary={() => void submitCurrentAnswer(true)}
							onPrimary={() => void submitCurrentAnswer()}
							primaryDisabled={!isAnswerReady}
							isBusy={isBusy}
							busyLabel={
								currentItem?.kind === "written" ? "Analysiere …" : undefined
							}
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
