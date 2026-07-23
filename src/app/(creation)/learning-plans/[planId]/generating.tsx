import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useFeatureFlag, usePostHog } from "posthog-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import { Text } from "~/components/ui/text";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { getGenerationProgressPresentation } from "~/features/learning-plans/generation-progress";
import { AnalysisOrbitLoader } from "~/features/learning-plans/learning-plan-ui";
import {
	LEARNING_SESSION_COMPOSITION_FLAG,
	resolveLearningSessionCompositionVariant,
} from "~/features/learning-plans/session-experiment";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { useValidationAnalytics } from "~/lib/analytics";
import {
	definedAnalyticsProperties,
	isPostHogConfigured,
} from "~/lib/analytics-core";
import { goBackOrReplace } from "~/lib/navigation";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

const quizPath = (id: Id<"learningPlans">, questionIndex: number) =>
	`/learning-plans/${id}/quiz/${questionIndex}` as const;

// Convex may terminate a Node action after 10 minutes. The extra minute avoids
// presenting recovery while the original action can still be active.
const STALE_CONTENT_GENERATION_MS = 11 * 60_000;

export default function LearningPlanGeneratingScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const generatePlan = useAction(api.learningPlanAi.generatePlan);
	const retryFailedSessionContent = useAction(
		api.learningPlanAi.retryFailedSessionContent,
	);
	const posthog = usePostHog();
	const { capture } = useValidationAnalytics();
	const compositionFlagValue = useFeatureFlag(
		LEARNING_SESSION_COMPOSITION_FLAG,
	);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [retryAttempt, setRetryAttempt] = useState(0);
	const [flagRetryAttempt, setFlagRetryAttempt] = useState(0);
	const [canRecoverStalledGeneration, setCanRecoverStalledGeneration] =
		useState(false);
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
	const sessionCompositionVariant =
		snapshot?.plan.sessionCompositionVariant ??
		resolveLearningSessionCompositionVariant(compositionFlagValue);
	const isExperimentAssignmentReady =
		Boolean(snapshot?.plan.sessionCompositionVariant) ||
		!isPostHogConfigured ||
		compositionFlagValue !== undefined;
	const progressPresentation = getGenerationProgressPresentation(
		snapshot?.plan.contentGeneration,
	);

	useEffect(() => {
		void flagRetryAttempt;
		if (isExperimentAssignmentReady) return undefined;
		const timeout = setTimeout(() => {
			setErrorMessage(
				"Deine Testgruppe konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.",
			);
		}, 8_000);
		return () => clearTimeout(timeout);
	}, [flagRetryAttempt, isExperimentAssignmentReady]);

	useEffect(() => {
		const generation = snapshot?.plan.contentGeneration;
		if (!generation || generation.stage !== "content") {
			const timeout = setTimeout(
				() => setCanRecoverStalledGeneration(false),
				0,
			);
			return () => clearTimeout(timeout);
		}
		const recoverAt =
			(generation.startedAt ?? Date.now()) + STALE_CONTENT_GENERATION_MS;
		const remainingMs = recoverAt - Date.now();
		if (remainingMs <= 0) {
			const timeout = setTimeout(() => setCanRecoverStalledGeneration(true), 0);
			return () => clearTimeout(timeout);
		}
		const timeout = setTimeout(
			() => setCanRecoverStalledGeneration(true),
			remainingMs,
		);
		return () => clearTimeout(timeout);
	}, [snapshot?.plan.contentGeneration]);

	useEffect(() => {
		void retryAttempt;
		if (!planId || !snapshot || !isExperimentAssignmentReady) return;

		if (missingAnswerRedirectTimeoutRef.current) {
			clearTimeout(missingAnswerRedirectTimeoutRef.current);
			missingAnswerRedirectTimeoutRef.current = null;
		}

		if (snapshot.plan.status === "generated") {
			router.replace(planPath(planId, "review"));
			return;
		}
		if (snapshot.plan.contentGeneration) return;

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
				sessionCompositionVariant,
			})
				.then((result) => {
					if (result.compositionEligibleSessionCount > 0) {
						void capture(
							"learning_session_composition_exposed",
							definedAnalyticsProperties({
								learning_plan_id: planId,
								feature_flag_key: LEARNING_SESSION_COMPOSITION_FLAG,
								session_composition_variant: sessionCompositionVariant,
								eligible_session_count: result.compositionEligibleSessionCount,
							}),
						);
					}
					void capture(
						"study_plan_generated",
						definedAnalyticsProperties({
							learning_plan_id: planId,
							session_count: result.sessionCount,
							answer_count: answerList.length,
							session_composition_variant: sessionCompositionVariant,
						}),
					);
				})
				.catch((error: unknown) => {
					setErrorMessage(
						getErrorMessage(
							error,
							"Der Lernplan konnte nicht erstellt werden.",
						),
					);
				})
				.finally(() => setIsBusy(false));
		});
	}, [
		answerList,
		capture,
		generatePlan,
		isExperimentAssignmentReady,
		planId,
		retryAttempt,
		router,
		sessionCompositionVariant,
		snapshot,
	]);

	useEffect(() => {
		return () => {
			if (missingAnswerRedirectTimeoutRef.current) {
				clearTimeout(missingAnswerRedirectTimeoutRef.current);
			}
		};
	}, []);

	const retryGeneration = async () => {
		if (!planId || isBusy) return;
		if (!isExperimentAssignmentReady) {
			posthog.reloadFeatureFlags();
			setErrorMessage(null);
			setFlagRetryAttempt((value) => value + 1);
			return;
		}

		setIsBusy(true);
		setErrorMessage(null);
		try {
			if (
				snapshot?.plan.contentGeneration &&
				snapshot.plan.contentGeneration.stage !== "ready" &&
				snapshot.sessions.length > 0
			) {
				await retryFailedSessionContent({ learningPlanId: planId });
				return;
			}
			if (
				snapshot?.plan.contentGeneration &&
				snapshot.plan.contentGeneration.stage !== "ready" &&
				snapshot.sessions.length === 0
			) {
				await generatePlan({
					learningPlanId: planId,
					answers: answerList,
					sessionCompositionVariant,
				});
				return;
			}

			didStartRef.current = false;
			setRetryAttempt((value) => value + 1);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Die fehlenden Lernsessionen konnten nicht erstellt werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const goBack = () => {
		if (planId) {
			router.replace(planPath(planId, "workload"));
			return;
		}

		goBackOrReplace(router, "/home");
	};
	useLearningPlanCreationProgress({
		active: true,
		currentStep: LEARNING_PLAN_CREATION_STEPS.workload,
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
					<Text className="text-center font-poppins font-semibold text-heading-2 text-text/70">
						Wir erstellen jetzt deinen vollständigen Lernplan.
					</Text>
					<Text className="mt-4 text-center font-poppins text-body-3 text-secondary-text">
						{progressPresentation.label}
					</Text>
					<FlowProgressBar
						className="mt-5 w-full max-w-[360px]"
						progress={progressPresentation.progress}
					/>
					{errorMessage ||
					progressPresentation.canRetryFailedSessions ||
					canRecoverStalledGeneration ? (
						<>
							{errorMessage ? (
								<Text className="mt-6 text-center font-poppins text-body-4 text-destructive">
									{errorMessage}
								</Text>
							) : null}
							<Button
								className="mt-6"
								disabled={isBusy}
								onPress={() => void retryGeneration()}
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
