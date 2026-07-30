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

const DEPTH_OPTIONS: Array<{
	value: PreparationDepth;
	label: string;
	description: string;
}> = [
	{
		value: "compact",
		label: "Kompakt",
		description: "Konzentriert sich auf die wichtigsten Lücken.",
	},
	{
		value: "thorough",
		label: "Gründlich",
		description: "Verbindet relevante Grundlagen, Übung und Praxis.",
	},
	{
		value: "intensive",
		label: "Intensiv",
		description: "Plant mehr Wiederholung und zusätzliche Praxis ein.",
	},
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
	const [selectedDepth, setSelectedDepth] = useState<PreparationDepth | null>(
		null,
	);
	const [isAdjustingDepth, setIsAdjustingDepth] = useState(false);
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
					Deine Vorbereitung ist bereit
				</Text>
				<Text className="mt-3 text-center font-poppins text-body-3 text-secondary-text">
					Dayova verbindet deinen Lernstand mit dem Prüfungsstoff und plant
					innerhalb deiner bestehenden Lernzeiten.
				</Text>
				{availableMinutes !== null && availableMinutes <= 0 ? (
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

				<Surface className="mt-8 rounded-[32px] px-6 py-7" variant="flat">
					<Text className="font-poppins text-body-4 text-secondary-text">
						Unsere Empfehlung
					</Text>
					<Text className="mt-2 font-poppins font-semibold text-body-1 text-text">
						{
							DEPTH_OPTIONS.find((option) => option.value === preparationDepth)
								?.label
						}{" "}
						vorbereiten
					</Text>
					<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
						{
							DEPTH_OPTIONS.find((option) => option.value === preparationDepth)
								?.description
						}
					</Text>
					<Text className="mt-4 font-poppins text-body-4 text-secondary-text">
						Die konkreten Inhalte werden nach jedem Lernschritt an deinen
						Fortschritt angepasst. Deine bestätigten Termine bleiben stabil.
					</Text>
				</Surface>
				<Button
					className="mt-4"
					variant="ghost"
					onPress={() => setIsAdjustingDepth((value) => !value)}
				>
					<Text>
						{isAdjustingDepth
							? "Empfehlung ausblenden"
							: "Vorbereitung anpassen"}
					</Text>
				</Button>
				{isAdjustingDepth ? (
					<View className="mt-3 gap-3">
						{DEPTH_OPTIONS.map((option) => (
							<Button
								key={option.value}
								className="h-auto min-h-16 justify-start px-5 py-4"
								variant={
									preparationDepth === option.value ? "default" : "outline"
								}
								onPress={() => setSelectedDepth(option.value)}
							>
								<View className="flex-1 items-start">
									<Text className="font-poppins font-semibold text-body-3">
										{option.label}
									</Text>
									<Text className="mt-1 font-poppins text-body-4 opacity-80">
										{option.description}
									</Text>
								</View>
							</Button>
						))}
					</View>
				) : null}
				{recommendation && recommendation.preparationGapMinutes > 0 ? (
					<Text className="mt-4 text-center font-poppins text-body-4 text-secondary-text">
						Deine verfügbare Zeit reicht nicht für die vollständige Empfehlung.
						Wir priorisieren deshalb die Themen mit dem größten Einfluss auf
						deine Arbeit.
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
					<Text>Empfohlenen Lernweg erstellen</Text>
				)}
			</Button>
		</Screen>
	);
}
