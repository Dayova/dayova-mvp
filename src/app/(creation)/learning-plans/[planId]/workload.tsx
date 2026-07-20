import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Screen } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import {
	calculateAvailableStudyMinutes,
	suggestTotalStudyMinutes,
} from "~/features/learning-plans/plan-workload";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";

const MIN_TOTAL_MINUTES = 10;
const MAX_TOTAL_MINUTES = 180;
const STEP_MINUTES = 10;

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

const todayDateKey = () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export default function LearningPlanWorkloadScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const setTargetStudyMinutes = useMutation(
		api.learningPlans.setTargetStudyMinutes,
	);
	const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const availableMinutes = useMemo(
		() =>
			snapshot && learningTimes
				? calculateAvailableStudyMinutes({
						fromDateKey: todayDateKey(),
						examDateKey: snapshot.plan.examDateKey,
						learningTimes,
					})
				: null,
		[learningTimes, snapshot],
	);
	const suggestedMinutes = useMemo(
		() =>
			snapshot
				? suggestTotalStudyMinutes({
						examDurationMinutes: snapshot.plan.durationMinutes,
						answers: snapshot.answers.map((answer) => answer.answer),
						availableMinutes,
					})
				: null,
		[availableMinutes, snapshot],
	);
	const minutes =
		selectedMinutes ?? snapshot?.plan.targetStudyMinutes ?? suggestedMinutes;

	useEffect(() => {
		if (!planId || !snapshot) return;
		if (snapshot.plan.status === "generated") {
			router.replace(planPath(planId, "review"));
		}
	}, [planId, router, snapshot]);

	const adjustMinutes = (delta: number) => {
		setSelectedMinutes(
			Math.min(
				MAX_TOTAL_MINUTES,
				Math.max(MIN_TOTAL_MINUTES, (minutes ?? 60) + delta),
			),
		);
	};

	const continueToGeneration = async () => {
		if (!planId || minutes === null || isBusy) return;
		setIsBusy(true);
		setErrorMessage(null);
		try {
			await setTargetStudyMinutes({
				learningPlanId: planId,
				targetStudyMinutes: minutes,
			});
			router.replace(planPath(planId, "generating"));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Die gesamte Lernzeit konnte nicht gespeichert werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const goBack = () => {
		if (!planId || !snapshot) return;
		const lastQuestionIndex = Math.max(
			snapshot.plan.knowledgeQuestions.length - 1,
			0,
		);
		router.replace(
			`/learning-plans/${planId}/quiz/${lastQuestionIndex}` as const,
		);
	};
	useLearningPlanCreationProgress({
		active: true,
		currentStep: LEARNING_PLAN_CREATION_STEPS.workload,
		onBack: goBack,
	});

	return (
		<Screen className="px-8 pb-12">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<View className="flex-1 justify-center">
				<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
					Wie viel Lernzeit planen wir ein?
				</Text>
				<Text className="mt-3 text-center font-poppins text-body-3 text-secondary-text">
					Dayova teilt diese Zeit in kurze Lernblöcke innerhalb deiner
					Lernzeiten auf.
				</Text>
				{availableMinutes !== null && availableMinutes > 0 ? (
					<Text className="mt-2 text-center font-poppins text-body-4 text-secondary-text">
						Bis zur Prüfung passen maximal {availableMinutes} Min. in deine
						Lernzeiten. Belegte Kalenderzeiten werden beim Erstellen
						berücksichtigt.
					</Text>
				) : null}

				<Surface
					className="mt-8 items-center rounded-[32px] px-6 py-8"
					variant="flat"
				>
					<Text className="font-poppins text-body-4 text-secondary-text">
						Geplante Lernzeit insgesamt
					</Text>
					<Text
						className="mt-2 font-poppins font-semibold text-[52px] text-text leading-[60px]"
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{minutes ?? "–"} Min.
					</Text>
					<View className="mt-7 w-full flex-row gap-3">
						<Button
							className="flex-1"
							variant="neutral"
							disabled={minutes === null || minutes <= MIN_TOTAL_MINUTES}
							onPress={() => adjustMinutes(-STEP_MINUTES)}
						>
							<Text>− 10 Min.</Text>
						</Button>
						<Button
							className="flex-1"
							variant="neutral"
							disabled={minutes === null || minutes >= MAX_TOTAL_MINUTES}
							onPress={() => adjustMinutes(STEP_MINUTES)}
						>
							<Text>+ 10 Min.</Text>
						</Button>
					</View>
				</Surface>
				{errorMessage ? (
					<Text className="mt-4 text-center font-poppins text-body-4 text-destructive">
						{errorMessage}
					</Text>
				) : null}
			</View>
			<Button
				disabled={minutes === null || isBusy}
				onPress={() => void continueToGeneration()}
			>
				{isBusy ? (
					<ActivityIndicator color="#FFFFFF" />
				) : (
					<Text>Persönlichen Lernplan erstellen</Text>
				)}
			</Button>
		</Screen>
	);
}
