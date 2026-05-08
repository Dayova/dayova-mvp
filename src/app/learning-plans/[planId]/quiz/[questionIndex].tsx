import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { useAuth } from "~/context/AuthContext";
import { QuizStep } from "~/features/learning-plans/quiz-step";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { useBackIntent } from "~/lib/navigation";

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
		router.replace(planPath(planId, "analysis"));
		return true;
	};

	useBackIntent(Boolean(planId), goBack);

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
		<KeyboardAvoidingView
			className="flex-1 bg-[#F5F3F6]"
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					flexGrow: 1,
					paddingHorizontal: 32,
					paddingTop: 80,
					paddingBottom: 60,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Header title="Quiz" onBack={goBack} showBack={questionIndex > 0} />
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
			</ScrollView>
		</KeyboardAvoidingView>
	);
}
