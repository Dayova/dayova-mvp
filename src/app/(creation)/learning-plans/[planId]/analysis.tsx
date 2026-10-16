import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Text } from "~/components/ui/text";
import { useAiConsent } from "~/context/AiConsentContext";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { learningPlanMaterialPath } from "~/features/learning-plans/creation-routes";
import { PlanPreparationProgress } from "~/features/learning-plans/plan-preparation-progress";
import {
	type PreparationStage,
	runPlanPreparation,
} from "~/features/learning-plans/run-plan-preparation";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import {
	dismissToOrReplace,
	goBackOrReplace,
	useBackIntent,
} from "~/lib/navigation";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export default function LearningPlanAnalysisScreen() {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { requestAiConsent } = useAiConsent();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const generateKnowledgeQuestions = useAction(
		api.learningPlanAi.generateKnowledgeQuestions,
	);
	const confirmScope = useMutation(api.learningPlans.confirmScope);
	const prepareDiagnostic = useMutation(api.learningPlans.prepareDiagnostic);
	const [stage, setStage] = useState<PreparationStage>(0);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [retryAttempt, setRetryAttempt] = useState(0);
	const didStartRef = useRef(false);
	const didCloseRef = useRef(false);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	useEffect(() => {
		void retryAttempt;
		if (!planId || !snapshot || didCloseRef.current) return;

		if (
			(snapshot.plan.status === "generated" &&
				snapshot.plan.diagnosticPlacement === "firstSession") ||
			snapshot.plan.status === "accepted"
		) {
			// A running pipeline owns navigation so a live snapshot cannot bypass pending requests.
			if (!didStartRef.current) router.replace(planPath(planId, "review"));
			return;
		}
		if (didStartRef.current) return;

		didStartRef.current = true;
		queueMicrotask(() => {
			setIsBusy(true);
			setErrorMessage(null);
			void runPlanPreparation({
				questionsReady:
					snapshot.plan.diagnosticPlacement === "firstSession" &&
					snapshot.plan.knowledgeQuestions.length > 0,
				scopeConfirmed: Boolean(snapshot.plan.scopeConfirmedAt),
				isCancelled: () => didCloseRef.current,
				onStage: setStage,
				analyze: async () => {
					const allowed = await requestAiConsent();
					if (didCloseRef.current) return;
					if (!allowed) {
						didCloseRef.current = true;
						dismissToOrReplace(router, learningPlanMaterialPath(planId));
						return;
					}
					if (!didCloseRef.current)
						await generateKnowledgeQuestions({ learningPlanId: planId });
				},
				confirm: async () => {
					trackFeature("learning_plan.scope_confirm", "attempted", planId);
					try {
						await confirmScope({ learningPlanId: planId });
						trackFeature("learning_plan.scope_confirm", "succeeded", planId);
					} catch (error) {
						trackFeature("learning_plan.scope_confirm", "failed", planId);
						throw error;
					}
				},
				prepare: () => prepareDiagnostic({ learningPlanId: planId }),
			})
				.then((completed) => {
					if (completed && !didCloseRef.current)
						router.replace(planPath(planId, "review"));
				})
				.catch((error: unknown) => {
					if (didCloseRef.current) return;
					const message = getErrorMessage(
						error,
						"Dein Lernplan konnte nicht vorbereitet werden. Bitte versuche es erneut.",
					);
					setErrorMessage(message);
				})
				.finally(() => setIsBusy(false));
		});
	}, [
		confirmScope,
		prepareDiagnostic,
		generateKnowledgeQuestions,
		planId,
		requestAiConsent,
		retryAttempt,
		router,
		snapshot,
		trackFeature,
	]);

	useEffect(() => {
		didCloseRef.current = false;
		return () => {
			didCloseRef.current = true;
		};
	}, []);

	const goBack = () => {
		didCloseRef.current = true;
		goBackOrReplace(
			router,
			planId ? learningPlanMaterialPath(planId) : "/learning-plans/new",
		);
		return true;
	};
	// Gestures are disabled below; keep the explicit review replacement free of
	// native removal prevention while retaining the Android back intent.
	useBackIntent(true, goBack, { allowRouteRemoval: true });
	useLearningPlanCreationProgress({
		active: true,
		currentStep: LEARNING_PLAN_CREATION_STEPS.materialAnalysis,
		onBack: goBack,
		onClose: () => {
			didCloseRef.current = true;
			dismissToOrReplace(router, "/learning-plans");
		},
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
				<View className="w-full max-w-[480px] self-center py-8">
					<PlanPreparationProgress
						stage={stage}
						failed={Boolean(errorMessage)}
					/>
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
