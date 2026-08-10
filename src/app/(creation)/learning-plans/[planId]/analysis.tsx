import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { AnimatedFlowerLoader } from "~/components/ui/animated-flower-loader";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Text } from "~/components/ui/text";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { learningPlanMaterialPath } from "~/features/learning-plans/creation-routes";
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

		if (
			snapshot.plan.status === "generated" &&
			snapshot.plan.diagnosticPlacement === "firstSession"
		) {
			router.replace(planPath(planId, "review"));
			return;
		}
		if (
			snapshot.plan.diagnosticPlacement === "firstSession" &&
			snapshot.plan.knowledgeQuestions.length > 0
		) {
			router.replace(
				snapshot.plan.scopeConfirmedAt
					? planPath(planId, "generating")
					: planPath(planId, "scope"),
			);
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
						"Deine Unterlagen konnten nicht zuverlässig analysiert werden.",
					);
					setErrorMessage(message);
					didStartRef.current = false;
					dismissToOrReplace(
						router,
						learningPlanMaterialPath(planId, {
							teacherGuidance: snapshot.plan.teacherGuidance,
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
			planId ? learningPlanMaterialPath(planId) : "/learning-plans/new",
		);
	};
	useLearningPlanCreationProgress({
		active: true,
		currentStep: LEARNING_PLAN_CREATION_STEPS.materialAnalysis,
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
					<View className="mb-12">
						<AnimatedFlowerLoader />
					</View>
					<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
						Wir ordnen deine Schulunterlagen.
					</Text>
					<Text className="mt-3 max-w-[320px] text-center font-poppins text-body-3 text-secondary-text">
						Dayova trennt wahrscheinlichen Prüfungsstoff von zusätzlichem
						Material und bereitet den Wissenscheck für deinen ersten Lerntermin
						vor.
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
