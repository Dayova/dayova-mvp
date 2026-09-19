import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Check, GraduationCap } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { learningPlanMaterialPath } from "~/features/learning-plans/creation-routes";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

const priorityLabel = {
	high: "Hohe Relevanz",
	medium: "Mittlere Relevanz",
	low: "Ergänzend",
} as const;

export default function LearningPlanScopeScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const confirmScope = useMutation(api.learningPlans.confirmScope);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const plan = useQuery(
		api.learningPlans.getPlanDetails,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	);

	useEffect(() => {
		if (!planId || !plan) return;
		if (plan.status === "generated") {
			router.replace(planPath(planId, "review"));
			return;
		}
		if (
			plan.diagnosticPlacement !== "firstSession" ||
			plan.knowledgeQuestions.length === 0
		) {
			router.replace(planPath(planId, "analysis"));
		}
	}, [plan, planId, router]);

	const goBack = () => {
		if (!planId) {
			goBackOrReplace(router, ROUTES.learningPlans);
			return true;
		}
		router.replace(learningPlanMaterialPath(planId));
		return true;
	};

	useBackIntent(true, goBack);
	useLearningPlanCreationProgress({
		active: true,
		currentStep: LEARNING_PLAN_CREATION_STEPS.scopeConfirmation,
		onBack: goBack,
	});

	const continueToPlan = async () => {
		if (!planId || isBusy) return;
		setIsBusy(true);
		setErrorMessage(null);
		try {
			await confirmScope({ learningPlanId: planId });
			router.replace(planPath(planId, "generating"));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Der erkannte Prüfungsstoff konnte nicht bestätigt werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ScreenScroll
				includeTopSafeArea={false}
				topPadding={0}
				contentContainerStyle={{ flexGrow: 1 }}
			>
				<View className="flex-1">
					<Text className="font-poppins font-semibold text-heading-2 text-text">
						Das haben wir verstanden
					</Text>
					<Text className="mt-3 font-poppins text-body-3 text-secondary-text">
						Dieser wahrscheinliche Prüfungsstoff basiert nur auf deinen
						Schulunterlagen und deiner Themenangabe.
					</Text>

					<Surface className="mt-7 rounded-[32px] px-5 py-5" variant="soft">
						<View className="flex-row items-center gap-3">
							<View className="h-11 w-11 items-center justify-center rounded-[18px] bg-system-subtle">
								<GraduationCap size={23} color="#00A0E6" strokeWidth={2.1} />
							</View>
							<Text className="flex-1 font-poppins font-semibold text-body-3 text-text">
								Zusammenfassung deiner Prüfungsunterlagen
							</Text>
						</View>
						<Text
							selectable
							className="mt-4 font-poppins text-body-3 text-secondary-text"
						>
							{plan?.sourceSummary ??
								"Deine Unterlagen werden noch zusammengefasst."}
						</Text>
					</Surface>

					<View className="mt-7 gap-3">
						{plan?.topicMap.map((topic) => (
							<Surface
								key={topic.id}
								className="flex-row items-start gap-3 rounded-[24px] px-4 py-4"
								variant="flat"
							>
								<View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-success-subtle">
									<Check size={16} color="#34C759" strokeWidth={2.4} />
								</View>
								<View className="min-w-0 flex-1">
									<Text className="font-poppins font-semibold text-body-3 text-text">
										{topic.title}
									</Text>
									<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
										{topic.learningGoal}
									</Text>
									<Text className="mt-2 font-poppins font-semibold text-body-5 text-primary">
										{priorityLabel[topic.priority]}
									</Text>
								</View>
							</Surface>
						))}
					</View>

					{errorMessage ? (
						<ErrorMessage className="mt-4">{errorMessage}</ErrorMessage>
					) : null}

					<View className="mt-auto gap-3 pt-8">
						<Button
							accessibilityLabel={
								isBusy
									? "Prüfungsstoff bestätigen, wird geladen"
									: "Prüfungsstoff bestätigen und Lernweg vorbereiten"
							}
							disabled={!plan || plan.topicMap.length === 0 || isBusy}
							onPress={() => void continueToPlan()}
						>
							{isBusy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text>Das passt – Lernweg vorbereiten</Text>
							)}
						</Button>
						<Button variant="neutral" disabled={isBusy} onPress={goBack}>
							<Text>Material ändern</Text>
						</Button>
					</View>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
