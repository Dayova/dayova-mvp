import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Text } from "~/components/ui/text";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { learningPlanTopicPath } from "~/features/learning-plans/creation-routes";
import { AnalysisOrbitLoader } from "~/features/learning-plans/learning-plan-ui";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { dismissToOrReplace, goBackOrReplace } from "~/lib/navigation";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export default function LearningPlanAnalysisScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const generateKnowledgeQuestions = useAction(
		api.learningPlanAi.generateKnowledgeQuestions,
	);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [retryAttempt, setRetryAttempt] = useState(0);
	const didStartRef = useRef(false);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	useEffect(() => {
		void retryAttempt;
		if (!planId || !snapshot) return;

		if (snapshot.plan.status === "generated") {
			router.replace(planPath(planId, "review"));
			return;
		}
		if (snapshot.plan.knowledgeQuestions.length > 0) {
			router.replace(`/learning-plans/${planId}/quiz/0`);
			return;
		}
		if (didStartRef.current) return;

		didStartRef.current = true;
		queueMicrotask(() => {
			setIsBusy(true);
			setErrorMessage(null);
			void generateKnowledgeQuestions({ learningPlanId: planId })
				.catch((error: unknown) => {
					const message = getErrorMessage(
						error,
						"Die Wissensanalyse konnte nicht vorbereitet werden.",
					);
					setErrorMessage(message);
					didStartRef.current = false;
					dismissToOrReplace(
						router,
						learningPlanTopicPath(planId, {
							topicDescription: snapshot.plan.topicDescription,
							errorMessage: message,
						}),
					);
				})
				.finally(() => setIsBusy(false));
		});
	}, [generateKnowledgeQuestions, planId, retryAttempt, router, snapshot]);

	const goBack = () => {
		goBackOrReplace(
			router,
			planId ? learningPlanTopicPath(planId) : "/learning-plans/new",
		);
	};
	useLearningPlanCreationProgress({
		active: true,
		currentStep: LEARNING_PLAN_CREATION_STEPS.topicDescription,
		onBack: goBack,
	});

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: false }} />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: 0,
					paddingBottom: 60,
				}}
				showsVerticalScrollIndicator={false}
			>
				<View className="min-h-[620px] flex-1 items-center justify-center pb-20">
					<AnalysisOrbitLoader />
					<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
						Beantworte 5 kurze Fragen – bei breitem Stoff höchstens 8.
					</Text>
					{errorMessage ? (
						<>
							<ErrorMessage className="mt-6 text-center">
								{errorMessage}
							</ErrorMessage>
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
