import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { KeyboardSafeScrollView } from "~/components/ui/keyboard-safe-scroll-view";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { getDiagnosticQuestionCreationStep } from "~/features/learning-plans/creation-progress";
import { LearningPlanCreationProgressHeader } from "~/features/learning-plans/creation-progress-header";
import { learningPlanTopicPath } from "~/features/learning-plans/creation-routes";
import { QuizStep } from "~/features/learning-plans/quiz-step";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";

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

	const goBack = () => {
		if (!planId) return true;
		if (questionIndex > 0) {
			router.replace(quizPath(planId, questionIndex - 1));
			return true;
		}
		goBackOrReplace(router, learningPlanTopicPath(planId));
		return true;
	};

	useBackIntent(Boolean(planId && questionIndex > 0), goBack);

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

			router.replace(planPath(planId, "workload"));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Die Antwort konnte nicht gespeichert werden."),
			);
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: true }} />
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
				<LearningPlanCreationProgressHeader
					currentStep={getDiagnosticQuestionCreationStep(questionIndex)}
					onBack={goBack}
				/>
				{currentQuestion ? (
					<QuizStep
						question={currentQuestion}
						answer={answer}
						errorMessage={errorMessage}
						isBusy={isBusy}
						onAnswerChange={setAnswer}
						onContinue={continueQuestion}
					/>
				) : null}
			</KeyboardSafeScrollView>
		</View>
	);
}
