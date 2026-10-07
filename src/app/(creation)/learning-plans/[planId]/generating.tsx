import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { useAiConsent } from "~/context/AiConsentContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { learningPlanMaterialPath } from "~/features/learning-plans/creation-routes";
import { getGenerationProgressPresentation } from "~/features/learning-plans/generation-progress";
import {
	getLearningPlanGenerationFailure,
	type LearningPlanGenerationFailure,
} from "~/features/learning-plans/generation-recovery";
import { logDiagnosticError } from "~/lib/diagnostics";
import { useBackIntent } from "~/lib/navigation";
import { ROUTES, withReturnTo } from "~/lib/routes";

const STALE_CONTENT_GENERATION_MS = 11 * 60_000;

export default function LearningPlanGeneratingScreen() {
	const { planId } = useLocalSearchParams<{ planId: string }>();
	const id = planId as Id<"learningPlans">;
	const router = useRouter();
	const { isAuthenticated } = useConvexAuth();
	const { requestAiConsent } = useAiConsent();
	const snapshot = useQuery(
		api.learningPlans.getSnapshot,
		isAuthenticated && id ? { id } : "skip",
	);
	const prepare = useMutation(api.learningPlans.prepareDiagnostic);
	const retryFailedContent = useAction(
		api.learningPlanAi.retryFailedSessionContent,
	);
	const started = useRef(false);
	const inFlight = useRef(false);
	const [isBusy, setIsBusy] = useState(false);
	const [failure, setFailure] = useState<LearningPlanGenerationFailure | null>(
		null,
	);
	const [canRecoverStalledGeneration, setCanRecoverStalledGeneration] =
		useState(false);
	const isComplete =
		snapshot?.plan.status === "generated" ||
		snapshot?.plan.status === "accepted";
	const needsAnalysis = Boolean(
		snapshot && snapshot.plan.diagnosticPlacement !== "firstSession",
	);
	// Only drafts created by the previous flow can have sessions without preparation state.
	const hasLegacySessions = Boolean(
		snapshot &&
			!snapshot.plan.preparationState &&
			snapshot.plan.contentGeneration &&
			snapshot.sessions.length > 0,
	);
	const generation = hasLegacySessions
		? snapshot?.plan.contentGeneration
		: undefined;
	const progress = getGenerationProgressPresentation(generation);
	const generationStage = generation?.stage;
	const generationStartedAt = generation?.startedAt;
	const displayedFailure =
		failure ??
		(generation?.stage === "failed"
			? getLearningPlanGenerationFailure(
					null,
					generation.failureReason,
					generation.failureMessage,
				)
			: null);

	useEffect(() => {
		if (!id || !isComplete) return;
		const frame = requestAnimationFrame(() =>
			router.replace(`/learning-plans/${id}/review`),
		);
		return () => cancelAnimationFrame(frame);
	}, [id, isComplete, router]);

	useEffect(() => {
		const reset = setTimeout(() => setCanRecoverStalledGeneration(false), 0);
		if (generationStage !== "content") return () => clearTimeout(reset);
		const delay = Math.max(
			0,
			(generationStartedAt ?? Date.now()) +
				STALE_CONTENT_GENERATION_MS -
				Date.now(),
		);
		const timeout = setTimeout(
			() => setCanRecoverStalledGeneration(true),
			delay,
		);
		return () => {
			clearTimeout(reset);
			clearTimeout(timeout);
		};
	}, [generationStage, generationStartedAt]);

	const runPreparation = useCallback(async () => {
		if (!id || inFlight.current || isComplete) return;
		inFlight.current = true;
		setIsBusy(true);
		try {
			if (hasLegacySessions) {
				if (!(await requestAiConsent())) return;
				await retryFailedContent({ learningPlanId: id });
			} else {
				await prepare({ learningPlanId: id });
			}
			setFailure(null);
		} catch (cause) {
			const nextFailure = getLearningPlanGenerationFailure(cause);
			logDiagnosticError(
				"Learning plan diagnostic preparation failed.",
				cause,
				{
					source: "learning-plans.generation",
					metadata: { learningPlanId: id, failureReason: nextFailure.reason },
				},
			);
			setFailure(nextFailure);
		} finally {
			inFlight.current = false;
			setIsBusy(false);
		}
	}, [
		hasLegacySessions,
		id,
		isComplete,
		prepare,
		requestAiConsent,
		retryFailedContent,
	]);

	useEffect(() => {
		if (!snapshot || !id || isComplete) return;
		if (needsAnalysis) {
			router.replace(`/learning-plans/${id}/analysis`);
			return;
		}
		if (hasLegacySessions || started.current) return;
		started.current = true;
		queueMicrotask(() => void runPreparation());
	}, [
		hasLegacySessions,
		id,
		isComplete,
		needsAnalysis,
		router,
		runPreparation,
		snapshot,
	]);

	const goBack = () => {
		router.replace(id ? `/learning-plans/${id}/scope` : ROUTES.learningPlans);
		return true;
	};
	useBackIntent(true, goBack, {
		allowRouteRemoval: isComplete || needsAnalysis,
	});
	useLearningPlanCreationProgress({
		active: true,
		currentStep: isComplete
			? LEARNING_PLAN_CREATION_STEPS.planGeneration
			: LEARNING_PLAN_CREATION_STEPS.scopeConfirmation,
		onBack: goBack,
	});
	const canRetry = Boolean(
		displayedFailure ||
			(hasLegacySessions && isBusy) ||
			progress.canRetryFailedSessions ||
			canRecoverStalledGeneration,
	);

	return (
		<Screen>
			<ScreenScroll
				topPadding={0}
				includeTopSafeArea={false}
				contentContainerStyle={{ flexGrow: 1 }}
			>
				<View className="flex-1 items-center justify-center gap-5 px-6">
					<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
						{canRetry
							? "Dein Lernweg braucht noch einen Schritt."
							: "Dein Wissenscheck wird vorbereitet"}
					</Text>
					{canRetry ? (
						<>
							{displayedFailure ? (
								<Text
									accessibilityRole="alert"
									className="text-center text-destructive"
								>
									{displayedFailure.message}
								</Text>
							) : null}
							{displayedFailure?.canReviewTopics ? (
								<Button disabled={isBusy} onPress={goBack}>
									<Text>Prüfungsstoff prüfen</Text>
								</Button>
							) : null}
							{displayedFailure?.canEditMaterial ? (
								<Button
									disabled={isBusy}
									onPress={() => router.replace(learningPlanMaterialPath(id))}
								>
									<Text>Material ergänzen oder ersetzen</Text>
								</Button>
							) : null}
							{hasLegacySessions && displayedFailure?.canEditLearningTimes ? (
								<Button
									disabled={isBusy}
									onPress={() =>
										router.push(
											withReturnTo(
												ROUTES.learningTimes,
												`/learning-plans/${id}/generating`,
											),
										)
									}
								>
									<Text>Lernzeit eintragen</Text>
								</Button>
							) : null}
							<Button
								disabled={isBusy}
								accessibilityState={{ busy: isBusy }}
								onPress={() => void runPreparation()}
							>
								<Text>Erneut versuchen</Text>
							</Button>
						</>
					) : (
						<ActivityIndicator
							accessibilityLabel="Wissenscheck wird vorbereitet"
							color="#00A0E6"
						/>
					)}
				</View>
			</ScreenScroll>
		</Screen>
	);
}
