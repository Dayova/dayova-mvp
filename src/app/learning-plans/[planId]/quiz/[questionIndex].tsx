import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { ActionModal } from "~/components/ui/action-modal";
import { Button } from "~/components/ui/button";
import { ClipboardEdit } from "~/components/ui/icon";
import { KeyboardSafeScrollView } from "~/components/ui/keyboard-safe-scroll-view";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { getLearningPlanCreationBackIntent } from "~/features/learning-plans/creation-navigation";
import { QuizStep } from "~/features/learning-plans/quiz-step";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useBackIntent } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";

const quizPath = (id: Id<"learningPlans">, questionIndex: number) =>
	`/learning-plans/${id}/quiz/${questionIndex}` as const;

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

const parseQuestionIndex = (value?: string) => {
	const parsed = Number(value ?? 0);
	if (!Number.isInteger(parsed) || parsed < 0) return 0;
	return parsed;
};

export default function LearningPlanQuizScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		planId?: string;
		questionIndex?: string;
	}>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const questionIndex = parseQuestionIndex(params.questionIndex);
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const saveKnowledgeAnswer = useMutation(
		api.learningPlans.saveKnowledgeAnswer,
	);
	const [answer, setAnswer] = useState("");
	const [isBusy, setIsBusy] = useState(false);
	const [isPauseConfirmationVisible, setIsPauseConfirmationVisible] =
		useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const loadedQuestionIdRef = useRef<string | null>(null);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const questions = snapshot?.plan.knowledgeQuestions ?? [];
	const currentQuestion = questions[questionIndex] ?? null;
	const storedAnswer =
		currentQuestion &&
		snapshot?.answers.find((item) => item.questionId === currentQuestion.id);

	useEffect(() => {
		if (!planId || !snapshot) return;

		if (snapshot.plan.status === "generated") {
			router.replace(planPath(planId, "review"));
			return;
		}
		if (questions.length === 0) {
			router.replace(planPath(planId, "analysis"));
			return;
		}
		if (questionIndex >= questions.length) {
			router.replace(quizPath(planId, questions.length - 1));
		}
	}, [planId, questionIndex, questions.length, router, snapshot]);

	useLayoutEffect(() => {
		if (!currentQuestion) return;
		if (loadedQuestionIdRef.current === currentQuestion.id) return;

		loadedQuestionIdRef.current = currentQuestion.id;
		setAnswer(storedAnswer?.answer ?? "");
		setErrorMessage(null);
	}, [currentQuestion, storedAnswer?.answer]);

	const goBack = useCallback(() => {
		if (!planId || isBusy) return true;

		const backIntent = getLearningPlanCreationBackIntent({
			questionIndex,
			isPauseConfirmationVisible,
		});
		if (backIntent.kind === "previousQuestion") {
			router.replace(quizPath(planId, backIntent.questionIndex));
			return true;
		}
		if (backIntent.kind === "confirmPause") {
			setIsPauseConfirmationVisible(true);
		}

		return true;
	}, [isBusy, isPauseConfirmationVisible, planId, questionIndex, router]);

	useBackIntent(Boolean(planId), goBack);

	const backSwipeGesture = Gesture.Pan()
		.enabled(
			Platform.OS === "ios" &&
				Boolean(planId) &&
				!isBusy &&
				!isPauseConfirmationVisible,
		)
		.hitSlop({ left: 0, width: 28 })
		.activeOffsetX(20)
		.failOffsetY([-20, 20])
		.onEnd((event) => {
			if (event.translationX >= 56) scheduleOnRN(goBack);
		});

	const continueLater = () => {
		setIsPauseConfirmationVisible(false);
		router.replace(ROUTES.learningPlans);
	};

	const continueQuestion = async () => {
		if (!planId || !currentQuestion || isBusy) return;
		const trimmedAnswer = answer.trim();
		if (!trimmedAnswer) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			await saveKnowledgeAnswer({
				learningPlanId: planId,
				questionId: currentQuestion.id,
				answer: trimmedAnswer,
			});
			if (questionIndex < questions.length - 1) {
				router.replace(quizPath(planId, questionIndex + 1));
				return;
			}

			router.replace(planPath(planId, "generating"));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Die Antwort konnte nicht gespeichert werden."),
			);
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<GestureDetector gesture={backSwipeGesture}>
			<View className="flex-1 bg-background">
				<Stack.Screen options={{ gestureEnabled: false }} />
				<ThemedStatusBar />
				<KeyboardSafeScrollView
					className="flex-1"
					bottomOffset={32}
					contentContainerStyle={{
						flexGrow: 1,
						paddingHorizontal: 32,
						paddingTop: 80,
						paddingBottom: 60,
					}}
				>
					<Header title="Lernplan erstellen" onBack={goBack} />
					{currentQuestion ? (
						<QuizStep
							question={currentQuestion}
							questionIndex={questionIndex}
							questionCount={questions.length}
							answer={answer}
							errorMessage={errorMessage}
							isBusy={isBusy}
							onAnswerChange={setAnswer}
							onContinue={continueQuestion}
						/>
					) : null}
				</KeyboardSafeScrollView>

				<ActionModal
					visible={isPauseConfirmationVisible}
					dismissible
					onClose={() => setIsPauseConfirmationVisible(false)}
					accessibilityLabel="Pause-Dialog schließen"
					title="Lernplan-Erstellung pausieren?"
					description="Deine bisherigen Antworten bleiben gespeichert. Du kannst die Erstellung später unter Lernpläne fortsetzen."
					icon={
						<ClipboardEdit
							size={40}
							color={DAYOVA_DESIGN_SYSTEM.colors.primary}
							strokeWidth={1.8}
						/>
					}
					iconContainerClassName="bg-system-subtle"
				>
					<View className="mt-6 gap-3">
						<Button onPress={() => setIsPauseConfirmationVisible(false)}>
							<Text>Weiter beantworten</Text>
						</Button>
						<Button
							variant="neutral"
							className="shadow-none"
							onPress={continueLater}
						>
							<Text>Später fortsetzen</Text>
						</Button>
					</View>
				</ActionModal>
			</View>
		</GestureDetector>
	);
}
