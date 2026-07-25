import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import {
	getDefaultPreparationDepth,
	recommendLearningPreparation,
	type PreparationDepth,
} from "#convex/learningPreparationPolicy";
import { Button } from "~/components/ui/button";
import { Screen } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { calculateAvailableStudyMinutes } from "~/features/learning-plans/plan-workload";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { ROUTES, withReturnTo } from "~/lib/routes";

const MIN_TOTAL_MINUTES = 10;
const MAX_TOTAL_MINUTES = 600;
const STEP_MINUTES = 10;

const DEPTH_OPTIONS: Array<{
	value: PreparationDepth;
	label: string;
}> = [
	{ value: "compact", label: "Kompakt" },
	{ value: "thorough", label: "Gründlich" },
	{ value: "intensive", label: "Intensiv" },
];

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
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const setTargetStudyMinutes = useMutation(
		api.learningPlans.setTargetStudyMinutes,
	);
	const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
	const [selectedDepth, setSelectedDepth] = useState<PreparationDepth | null>(
		null,
	);
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
	const preparationDepth =
		selectedDepth ??
		snapshot?.plan.preparationDepth ??
		(snapshot
			? getDefaultPreparationDepth(snapshot.plan.examTypeLabel)
			: "thorough");
	const recommendation = useMemo(() => {
		if (!snapshot) return null;
		const assessedTopicCount = Math.max(
			snapshot.plan.topicMap.length,
			snapshot.answers.length,
		);
		const readiness = snapshot.plan.topicReadiness ?? [];
		const secure = readiness.filter(
			(topic) => topic.status === "secure",
		).length;
		const developing = readiness.filter(
			(topic) => topic.status === "developing",
		).length;
		const unknown = readiness.filter(
			(topic) => topic.status === "unknown",
		).length;

		return recommendLearningPreparation({
			examTypeLabel: snapshot.plan.examTypeLabel,
			examDurationMinutes: snapshot.plan.durationMinutes,
			preparationDepth,
			topicReadiness: {
				secure,
				developing,
				unknown: Math.max(unknown, assessedTopicCount - readiness.length),
			},
			availableMinutes,
		});
	}, [availableMinutes, preparationDepth, snapshot]);
	const minutes =
		selectedMinutes ??
		(selectedDepth ? null : snapshot?.plan.targetStudyMinutes) ??
		recommendation?.plannedMinutes ??
		null;
	const hasNoAvailability = availableMinutes !== null && availableMinutes < 10;

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
				preparationDepth,
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
					Wähle die Vorbereitungstiefe. Dayova plant daraus mehrere kurze,
					fokussierte Lernsessionen statt eines langen Blocks.
				</Text>
				{availableMinutes !== null && availableMinutes > 0 ? (
					<Text className="mt-2 text-center font-poppins text-body-4 text-secondary-text">
						Bis zur Prüfung passen maximal {availableMinutes} Min. in deine
						Lernzeiten. Belegte Kalenderzeiten werden beim Erstellen
						berücksichtigt.
					</Text>
				) : availableMinutes !== null ? (
					<>
						<Text className="mt-3 text-center font-poppins text-body-4 text-destructive">
							Vor der Prüfung ist noch keine passende Lernzeit hinterlegt.
						</Text>
						{planId ? (
							<Button
								className="mt-4"
								variant="outline"
								onPress={() =>
									router.push(
										withReturnTo(
											ROUTES.learningTimes,
											planPath(planId, "workload"),
										),
									)
								}
							>
								<Text>Lernzeiten festlegen</Text>
							</Button>
						) : null}
					</>
				) : null}

				<View className="mt-6 flex-row gap-2">
					{DEPTH_OPTIONS.map((option) => (
						<Button
							key={option.value}
							className="flex-1 px-2"
							size="sm"
							variant={
								preparationDepth === option.value ? "default" : "outline"
							}
							onPress={() => {
								setSelectedDepth(option.value);
								setSelectedMinutes(null);
							}}
						>
							<Text>{option.label}</Text>
						</Button>
					))}
				</View>

				<Surface
					className="mt-8 items-center rounded-[32px] px-6 py-8"
					variant="flat"
				>
					<Text className="font-poppins text-body-4 text-secondary-text">
						Geplante Lernzeit insgesamt
					</Text>
					{recommendation ? (
						<Text className="mt-2 text-center font-poppins text-body-4 text-secondary-text">
							Empfohlen {recommendation.recommendedMinutes} Min. · Minimum{" "}
							{recommendation.minimumMinutes} Min.
						</Text>
					) : null}
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
				{recommendation && recommendation.preparationGapMinutes > 0 ? (
					<Text className="mt-4 text-center font-poppins text-body-4 text-secondary-text">
						Bis zur Prüfung fehlen in deinen Lernzeiten noch{" "}
						{recommendation.preparationGapMinutes} Min. zur empfohlenen
						Vorbereitung. Wir erstellen den stärksten möglichen Plan für deine
						verfügbare Zeit.
					</Text>
				) : null}
				{errorMessage ? (
					<Text className="mt-4 text-center font-poppins text-body-4 text-destructive">
						{errorMessage}
					</Text>
				) : null}
			</View>
			<Button
				disabled={
					minutes === null || minutes < 10 || hasNoAvailability || isBusy
				}
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
