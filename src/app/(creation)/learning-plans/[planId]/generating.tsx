import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { AnimatedFlowerLoader } from "~/components/ui/animated-flower-loader";
import { Button } from "~/components/ui/button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import { Text } from "~/components/ui/text";
import { useAiConsent } from "~/context/AiConsentContext";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { getGenerationProgressPresentation } from "~/features/learning-plans/generation-progress";
import { generatePlanWithAnalytics } from "~/features/learning-plans/plan-generation-analytics";
import {
	calculateAvailableStudyMinutes,
	getAutomaticLearningPreparation,
	MIN_ROLLING_HORIZON_MINUTES,
} from "~/features/learning-plans/plan-workload";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { getDayKey } from "~/lib/day-key";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { useValidationAnalytics } from "~/lib/use-validation-analytics";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

// Convex may terminate a Node action after 10 minutes. The extra minute avoids
// presenting recovery while the original action can still be active.
const STALE_CONTENT_GENERATION_MS = 11 * 60_000;
const EMPTY_KNOWLEDGE_ANSWERS: Array<{
	questionId: string;
	answer: string;
}> = [];

export default function LearningPlanGeneratingScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { requestAiConsent } = useAiConsent();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const generatePlan = useAction(api.learningPlanAi.generatePlan);
	const retryFailedSessionContent = useAction(
		api.learningPlanAi.retryFailedSessionContent,
	);
	const setTargetStudyMinutes = useMutation(
		api.learningPlans.setTargetStudyMinutes,
	);
	const { capture } = useValidationAnalytics();
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [retryAttempt, setRetryAttempt] = useState(0);
	const [canRecoverStalledGeneration, setCanRecoverStalledGeneration] =
		useState(false);
	const didStartRef = useRef(false);
	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated ? {} : "skip",
	);

	const availableStudyMinutes = useMemo(
		() =>
			snapshot && learningTimes
				? calculateAvailableStudyMinutes({
						fromDateKey: getDayKey(new Date()),
						examDateKey: snapshot.plan.examDateKey,
						learningTimes,
					})
				: null,
		[learningTimes, snapshot],
	);
	const automaticPreparation = useMemo(
		() =>
			snapshot && availableStudyMinutes !== null
				? getAutomaticLearningPreparation({
						examTypeLabel: snapshot.plan.examTypeLabel,
						examDurationMinutes: snapshot.plan.durationMinutes,
						preparationDepth: snapshot.plan.preparationDepth,
						topicCount: snapshot.plan.topicMap.length,
						answerCount: snapshot.answers.length,
						topicReadiness: snapshot.plan.topicReadiness ?? [],
						availableMinutes: availableStudyMinutes,
					})
				: null,
		[availableStudyMinutes, snapshot],
	);
	const needsLearningTime =
		availableStudyMinutes !== null &&
		(availableStudyMinutes < MIN_ROLLING_HORIZON_MINUTES ||
			(automaticPreparation?.recommendation.plannedMinutes ??
				MIN_ROLLING_HORIZON_MINUTES) < MIN_ROLLING_HORIZON_MINUTES);
	const sessionCompositionVariant = "split" as const;
	const progressPresentation = getGenerationProgressPresentation(
		snapshot?.plan.contentGeneration,
	);

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
		if (!planId || !snapshot) return;

		if (snapshot.plan.status === "generated") {
			router.replace(planPath(planId, "review"));
			return;
		}
		if (snapshot.plan.diagnosticPlacement !== "firstSession") {
			router.replace(planPath(planId, "analysis"));
			return;
		}
		if (snapshot.plan.contentGeneration) return;

		if (!snapshot.plan.targetStudyMinutes && !automaticPreparation) return;
		if (
			!snapshot.plan.targetStudyMinutes &&
			automaticPreparation &&
			automaticPreparation.recommendation.plannedMinutes <
				MIN_ROLLING_HORIZON_MINUTES
		) {
			queueMicrotask(() => {
				setErrorMessage(
					"Vor deiner Prüfung sind noch nicht zwei passende Lerntermine frei. Gehe zurück und ergänze zuerst Lernzeit.",
				);
			});
			return;
		}
		if (didStartRef.current) return;

		didStartRef.current = true;
		queueMicrotask(() => {
			setIsBusy(true);
			setErrorMessage(null);
			void (async () => {
				if (!(await requestAiConsent())) {
					didStartRef.current = false;
					router.replace(planPath(planId, "scope"));
					return;
				}
				if (!snapshot.plan.targetStudyMinutes && automaticPreparation) {
					await setTargetStudyMinutes({
						learningPlanId: planId,
						targetStudyMinutes:
							automaticPreparation.recommendation.plannedMinutes,
						preparationDepth: automaticPreparation.preparationDepth,
					});
				}
				await generatePlanWithAnalytics({
					generatePlan,
					capture,
					args: {
						learningPlanId: planId,
						answers: EMPTY_KNOWLEDGE_ANSWERS,
						sessionCompositionVariant,
					},
				});
			})()
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
		automaticPreparation,
		capture,
		generatePlan,
		planId,
		requestAiConsent,
		retryAttempt,
		router,
		setTargetStudyMinutes,
		sessionCompositionVariant,
		snapshot,
	]);

	const retryGeneration = async () => {
		if (!planId || isBusy) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			if (!(await requestAiConsent())) return;
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
				await generatePlanWithAnalytics({
					generatePlan,
					capture,
					args: {
						learningPlanId: planId,
						answers: EMPTY_KNOWLEDGE_ANSWERS,
						sessionCompositionVariant,
					},
				});
				return;
			}

			didStartRef.current = false;
			setRetryAttempt((value) => value + 1);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Die fehlenden Lernblöcke konnten nicht erstellt werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const openLearningTimes = () => {
		if (!planId) return;
		didStartRef.current = false;
		router.push(
			withReturnTo(ROUTES.learningTimes, planPath(planId, "generating")),
		);
	};

	const goBack = () => {
		if (planId && snapshot) {
			router.replace(planPath(planId, "scope"));
			return true;
		}

		goBackOrReplace(router, "/home");
		return true;
	};
	useBackIntent(true, goBack);
	useLearningPlanCreationProgress({
		active: true,
		currentStep: LEARNING_PLAN_CREATION_STEPS.planGeneration,
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
					<Text className="text-center font-poppins font-semibold text-heading-2 text-text/70">
						Wir bereiten deinen nächsten Lernschritt vor.
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
								onPress={() => {
									if (needsLearningTime) {
										openLearningTimes();
										return;
									}
									void retryGeneration();
								}}
							>
								{isBusy ? (
									<ActivityIndicator color="#FFFFFF" />
								) : (
									<Text>
										{needsLearningTime
											? "Lernzeit eintragen"
											: "Erneut versuchen"}
									</Text>
								)}
							</Button>
							{errorMessage && !needsLearningTime ? (
								<Button
									className="mt-3"
									disabled={isBusy}
									variant="neutral"
									onPress={openLearningTimes}
								>
									<Text>Lernzeiten anpassen</Text>
								</Button>
							) : null}
						</>
					) : null}
				</View>
			</ScrollView>
		</View>
	);
}
