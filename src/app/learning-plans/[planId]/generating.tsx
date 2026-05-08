import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { AnalysisOrbitLoader } from "~/features/learning-plans/learning-plan-ui";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { goBackOrReplace } from "~/lib/navigation";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

const quizPath = (id: Id<"learningPlans">, questionIndex: number) =>
	`/learning-plans/${id}/quiz/${questionIndex}` as const;

export default function LearningPlanGeneratingScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const generatePlan = useAction(api.learningPlanAi.generatePlan);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [retryAttempt, setRetryAttempt] = useState(0);
	const didStartRef = useRef(false);
	const missingAnswerRedirectTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const answerList = useMemo(() => {
		const answers = snapshot?.answers ?? [];
		return (snapshot?.plan.knowledgeQuestions ?? []).map((question) => ({
			questionId: question.id,
			answer:
				answers
					.find((item) => item.questionId === question.id)
					?.answer.trim() ?? "",
		}));
	}, [snapshot]);

	useEffect(() => {
		void retryAttempt;
		if (!planId || !snapshot) return;

		if (missingAnswerRedirectTimeoutRef.current) {
			clearTimeout(missingAnswerRedirectTimeoutRef.current);
			missingAnswerRedirectTimeoutRef.current = null;
		}

		if (snapshot.plan.status === "generated") {
			router.replace(planPath(planId, "review"));
			return;
		}

		const missingAnswerIndex = answerList.findIndex((item) => !item.answer);
		if (missingAnswerIndex >= 0) {
			missingAnswerRedirectTimeoutRef.current = setTimeout(() => {
				router.replace(quizPath(planId, missingAnswerIndex));
			}, 600);
			return;
		}
		if (didStartRef.current) return;

		didStartRef.current = true;
		queueMicrotask(() => {
			setIsBusy(true);
			setErrorMessage(null);
			void generatePlan({
				learningPlanId: planId,
				answers: answerList,
			})
				.catch((error: unknown) => {
					setErrorMessage(
						getErrorMessage(
							error,
							"Der Lernplan konnte nicht erstellt werden.",
						),
					);
					didStartRef.current = false;
				})
				.finally(() => setIsBusy(false));
		});
	}, [answerList, generatePlan, planId, retryAttempt, router, snapshot]);

	useEffect(() => {
		return () => {
			if (missingAnswerRedirectTimeoutRef.current) {
				clearTimeout(missingAnswerRedirectTimeoutRef.current);
			}
		};
	}, []);

	const goBack = () => {
		if (planId) {
			const lastQuestionIndex = Math.max(
				(snapshot?.plan.knowledgeQuestions.length ?? 1) - 1,
				0,
			);
			router.replace(quizPath(planId, lastQuestionIndex));
			return;
		}

		goBackOrReplace(router, "/home");
	};

	return (
		<View className="flex-1 bg-[#F5F3F6]">
			<Stack.Screen options={{ gestureEnabled: false }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: 80,
					paddingBottom: 60,
				}}
				showsVerticalScrollIndicator={false}
			>
				<Header title="Lernplan" onBack={goBack} />
				<View className="min-h-[620px] flex-1 items-center justify-center pb-20">
					<AnalysisOrbitLoader />
					<Text
						className="text-center font-poppins font-semibold text-text/70"
						style={{ fontSize: 23, lineHeight: 26 }}
					>
						Aus deinen Antworten erstellen wir deinen persönlichen Lernplan.
					</Text>
					{errorMessage ? (
						<>
							<Text className="mt-6 text-center font-poppins text-12 text-destructive">
								{errorMessage}
							</Text>
							<Button
								className="mt-6"
								disabled={isBusy}
								onPress={() => {
									didStartRef.current = false;
									setErrorMessage(null);
									setRetryAttempt((value) => value + 1);
								}}
							>
								{isBusy ? (
									<ActivityIndicator color="#FFFFFF" />
								) : (
									<Text>Erneut versuchen</Text>
								)}
							</Button>
						</>
					) : null}
				</View>
			</ScrollView>
		</View>
	);
}
