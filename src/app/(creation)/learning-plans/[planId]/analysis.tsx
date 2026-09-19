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
import { useAiConsent } from "~/context/AiConsentContext";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { learningPlanMaterialPath } from "~/features/learning-plans/creation-routes";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import {
	dismissToOrReplace,
	goBackOrReplace,
	useBackIntent,
} from "~/lib/navigation";
import { logDiagnosticError } from "~/lib/diagnostics";
import {
	getLearningPlanGenerationFailure,
	type LearningPlanGenerationFailure,
} from "~/features/learning-plans/generation-recovery";
import { learningPlanTopicsPath } from "~/features/learning-plans/creation-routes";
import { extractUserFacingErrorCode } from "~/lib/user-facing-errors";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export default function LearningPlanAnalysisScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { requestAiConsent } = useAiConsent();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const generateKnowledgeQuestions = useAction(
		api.learningPlanAi.generateKnowledgeQuestions,
	);
	const [isBusy, setIsBusy] = useState(false);
	const [failure, setFailure] = useState<LearningPlanGenerationFailure | null>(
		null,
	);
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
			setFailure(null);
			void requestAiConsent()
				.then((allowed) => {
					if (!allowed) {
						didStartRef.current = false;
						dismissToOrReplace(router, learningPlanMaterialPath(planId));
						return null;
					}
					return generateKnowledgeQuestions({ learningPlanId: planId });
				})
				.catch((error: unknown) => {
					const errorCode = extractUserFacingErrorCode(error) ?? undefined;
					if (errorCode === "aiConsentRequired") {
						didStartRef.current = false;
						dismissToOrReplace(router, learningPlanMaterialPath(planId, { errorCode }));
						return;
					}
					const nextFailure = getLearningPlanGenerationFailure(error);
					logDiagnosticError("Learning plan material analysis failed.", error, {
						source: "learning-plans.analysis",
						metadata: {
							learningPlanId: planId,
							failureReason: nextFailure.reason,
						},
					});
					setFailure(nextFailure);
					didStartRef.current = false;
				})
				.finally(() => setIsBusy(false));
		});
	}, [
		generateKnowledgeQuestions,
		planId,
		requestAiConsent,
		retryAttempt,
		router,
		snapshot,
	]);

	const goBack = () => {
		goBackOrReplace(
			router,
			planId ? learningPlanMaterialPath(planId) : "/learning-plans/new",
		);
		return true;
	};
	const reviewTopics = () => {
		if (!planId || !snapshot) return;
		router.replace(
			snapshot.plan.topicMap.length > 0
				? planPath(planId, "scope")
				: learningPlanTopicsPath(planId, {
						topicDescription: snapshot.plan.topicDescription,
					}),
		);
	};
	const editMaterial = () => {
		if (!planId) return;
		dismissToOrReplace(router, learningPlanMaterialPath(planId));
	};
	useBackIntent(true, goBack);
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
					{failure ? (
						<>
							<ErrorMessage className="mt-6 text-center">
								{failure.message}
							</ErrorMessage>
							{failure.canReviewTopics ? (
								<Button className="mt-6" onPress={reviewTopics}>
									<Text>Prüfungsstoff prüfen</Text>
								</Button>
							) : null}
							{failure.canEditMaterial ? (
								<Button
									className={failure.canReviewTopics ? "mt-3" : "mt-6"}
									variant={failure.canReviewTopics ? "neutral" : "default"}
									onPress={editMaterial}
								>
									<Text>Material ergänzen oder ersetzen</Text>
								</Button>
							) : null}
							<Button
								className="mt-3"
								disabled={isBusy}
								onPress={() => {
									didStartRef.current = false;
									setFailure(null);
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
