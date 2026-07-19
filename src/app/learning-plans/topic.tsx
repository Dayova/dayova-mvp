import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { WarningBanner } from "~/components/ui/warning-banner";
import { useAuth } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { LearningPlanCreationProgressHeader } from "~/features/learning-plans/creation-progress-header";
import {
	learningPlanStepPath,
	learningPlanTopicPath,
	learningPlanUploadPath,
} from "~/features/learning-plans/creation-routes";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import {
	getErrorMessage,
	retryOnceAfterAuthResume,
} from "~/features/learning-plans/utils";
import { goBackOrReplace } from "~/lib/navigation";
import { ROUTES, withReturnTo } from "~/lib/routes";

export default function LearningPlanTopicScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		learningPlanId?: string;
		topicDescription?: string;
		errorMessage?: string;
	}>();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const updateBasics = useMutation(api.learningPlans.updateBasics);
	const learningPlanId = params.learningPlanId as
		| Id<"learningPlans">
		| undefined;
	const [topicDescriptionInput, setTopicDescriptionInput] = useState<
		string | null
	>(params.topicDescription ?? null);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(
		params.errorMessage ?? null,
	);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && learningPlanId
			? { id: learningPlanId }
			: "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated && learningPlanId ? {} : "skip",
	);
	const topicDescription =
		topicDescriptionInput ?? snapshot?.plan.topicDescription ?? "";
	const canWrite = Boolean(user && isConvexAuthenticated && learningPlanId);
	const canContinue = topicDescription.trim().length >= 8 && canWrite;
	const showLearningTimesWarning =
		learningTimes !== undefined && learningTimes.length === 0;

	const continueToAnalysis = async () => {
		if (!learningPlanId || !canContinue || isBusy) return;

		setIsBusy(true);
		setErrorMessage(null);
		try {
			await retryOnceAfterAuthResume(() =>
				updateBasics({
					id: learningPlanId,
					topicDescription,
					notes: "",
				}),
			);
			router.push(learningPlanStepPath(learningPlanId, "analysis"));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Das Prüfungsthema konnte nicht gespeichert werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const goBack = () => {
		if (learningPlanId) {
			goBackOrReplace(router, learningPlanUploadPath(learningPlanId));
			return;
		}
		goBackOrReplace(router, ROUTES.createLearningPlan);
	};

	const openLearningTimes = () => {
		if (!learningPlanId) return;
		router.push(
			withReturnTo(
				ROUTES.learningTimes,
				learningPlanTopicPath(learningPlanId, { topicDescription }),
			),
		);
	};

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ThemedStatusBar />
			<ScreenScroll contentContainerStyle={{ flexGrow: 1 }}>
				<LearningPlanCreationProgressHeader
					currentStep={LEARNING_PLAN_CREATION_STEPS.topicDescription}
					onBack={goBack}
					title="Prüfungsthema"
				/>
				<View className="flex-1 pt-10">
					{showLearningTimesWarning ? (
						<WarningBanner
							className="mb-7"
							title="Lernzeiten fehlen"
							description="Ohne Lernzeiten weiß Dayova nicht, wann der Lernplan eingetragen werden soll. Lege mindestens eine Lernzeit an, damit wir deinen Plan erstellen können."
							ctaLabel="Lernzeiten eintragen"
							onPressCta={openLearningTimes}
						/>
					) : null}
					<Text className="font-poppins font-semibold text-body-1 text-text">
						Welche Themen kommen in deiner Prüfung dran?
					</Text>
					<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
						Nenne die wichtigsten Inhalte, Kapitel oder Schwerpunkte.
					</Text>
					<Textarea
						autoFocus
						accessibilityLabel="Prüfungsthemen"
						className="mt-4 min-h-[180px] flex-1 py-2"
						value={topicDescription}
						onChangeText={setTopicDescriptionInput}
						placeholder="Beschreibe kurz deine Prüfungsthemen."
					/>
					{errorMessage ? (
						<Text
							selectable
							accessibilityRole="alert"
							className="mt-4 font-poppins text-body-4 text-destructive"
						>
							{errorMessage}
						</Text>
					) : null}
					<View className="mt-auto pt-8">
						<Button
							accessibilityLabel={isBusy ? "Weiter, wird geladen" : "Weiter"}
							accessibilityLiveRegion={isBusy ? "polite" : undefined}
							accessibilityState={{
								busy: isBusy,
								disabled: !canContinue || isBusy,
							}}
							disabled={!canContinue || isBusy}
							onPress={() => void continueToAnalysis()}
						>
							{isBusy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text>Weiter</Text>
							)}
						</Button>
					</View>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
