import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Plus } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import {
	PlanningHintBanner,
	SectionTitle,
	SessionCard,
} from "~/features/learning-plans/learning-plan-ui";
import {
	buildPlanGenerationAnswers,
	LEARNING_TIME_REPLAN_PARAM,
	shouldReplanAfterLearningTimes,
} from "~/features/learning-plans/replan-recovery";
import type {
	LearningPlanSnapshot,
	PlanSession,
} from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { goBackOrReplace } from "~/lib/navigation";
import { ROUTES, withReturnTo } from "~/lib/routes";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

const successPath = (
	id: Id<"learningPlans">,
	params: {
		dayKey: string;
		examDateKey: string;
		examDateLabel: string;
		examTime: string;
	},
) => {
	const query = Object.entries(params)
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("&");
	return `/learning-plans/${id}/success?${query}` as const;
};

export default function LearningPlanReviewScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{
		planId?: string;
		replan?: string;
		replanRequest?: string;
	}>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const generatePlan = useAction(api.learningPlanAi.generatePlan);
	const addSession = useMutation(api.learningPlans.addSession);
	const acceptPlan = useMutation(api.learningPlans.acceptPlan);

	const [isBusy, setIsBusy] = useState(false);
	const [isReplanning, setIsReplanning] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const attemptedReplanKeyRef = useRef<string | null>(null);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const answerList = useMemo(
		() => (snapshot ? buildPlanGenerationAnswers(snapshot) : []),
		[snapshot],
	);
	const hasSessions = Boolean(snapshot?.sessions.length);
	const planActionsDisabled = isBusy || isReplanning || !hasSessions;

	useEffect(() => {
		if (!planId || !snapshot) return;

		if (
			snapshot.plan.status === "draft" ||
			snapshot.plan.status === "questionsReady"
		) {
			router.replace(planPath(planId, "analysis"));
		}
	}, [planId, router, snapshot]);

	useEffect(() => {
		if (!planId || !snapshot) return;
		if (!shouldReplanAfterLearningTimes(snapshot, params.replan)) return;
		const replanAttemptKey = [
			planId,
			params.replan,
			params.replanRequest ?? "",
		].join(":");
		if (attemptedReplanKeyRef.current === replanAttemptKey) return;

		attemptedReplanKeyRef.current = replanAttemptKey;
		setIsReplanning(true);
		setErrorMessage(null);
		void generatePlan({
			learningPlanId: planId,
			answers: answerList,
		})
			.then(() => {
				if (attemptedReplanKeyRef.current !== replanAttemptKey) return;
				router.replace(planPath(planId, "review"));
			})
			.catch((error: unknown) => {
				if (attemptedReplanKeyRef.current !== replanAttemptKey) return;
				setErrorMessage(
					getErrorMessage(
						error,
						"Der Lernplan konnte mit den neuen Lernzeiten nicht aktualisiert werden.",
					),
				);
				router.replace(planPath(planId, "review"));
			})
			.finally(() => {
				if (attemptedReplanKeyRef.current !== replanAttemptKey) return;
				setIsReplanning(false);
			});
	}, [
		answerList,
		generatePlan,
		params.replan,
		params.replanRequest,
		planId,
		router,
		snapshot,
	]);

	const runWithErrorHandling = async <TResult,>(
		fallback: string,
		task: () => Promise<TResult>,
	): Promise<TResult | null> => {
		setIsBusy(true);
		setErrorMessage(null);
		try {
			return await task();
		} catch (error) {
			setErrorMessage(getErrorMessage(error, fallback));
			return null;
		} finally {
			setIsBusy(false);
		}
	};

	const openEdit = (session: PlanSession) => {
		if (!planId) return;
		router.push(`/learning-plans/${planId}/sessions/${session.id}/edit`);
	};

	const acceptGeneratedPlan = async () => {
		if (!planId || !snapshot || isBusy || isReplanning) return;

		const dayKey = await runWithErrorHandling(
			"Der Lernplan konnte nicht eingetragen werden.",
			() => acceptPlan({ learningPlanId: planId }),
		);
		if (!dayKey) return;

		router.replace(
			successPath(planId, {
				dayKey,
				examDateKey: snapshot.plan.examDateKey,
				examDateLabel: snapshot.plan.examDateLabel,
				examTime: snapshot.plan.examTime,
			}),
		);
	};

	const addRecommendedSession = async () => {
		if (!planId || isBusy || isReplanning) return;

		await runWithErrorHandling(
			"Der zusätzliche Lerntag konnte nicht erstellt werden.",
			async () => {
				await addSession({ learningPlanId: planId });
			},
		);
	};

	const openLearningTimes = () => {
		if (!planId) return;
		router.push(
			withReturnTo(
				ROUTES.learningTimes,
				`${planPath(planId, "review")}?replan=${LEARNING_TIME_REPLAN_PARAM}&replanRequest=${Date.now()}`,
			),
		);
	};

	const goBack = useCallback(() => {
		if (planId) {
			router.replace(planPath(planId, "generating"));
			return true;
		}
		goBackOrReplace(router, "/home");
		return true;
	}, [planId, router]);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					flexGrow: 1,
					paddingHorizontal: 32,
					paddingTop: 80,
					paddingBottom: 150,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Header title="Lernplan" onBack={goBack} showBack={false} />
				<SectionTitle
					title="Lernplan erstellen"
					description="Passe deine Lerntage an und trage den Plan danach in den Kalender ein."
				/>
				{snapshot?.plan.planningHint ? (
					<PlanningHintBanner
						className="mb-6"
						hint={snapshot.plan.planningHint}
						onPressLearningTimes={openLearningTimes}
					/>
				) : null}
				<View className="flex-1 gap-6">
					{isReplanning ? (
						<View className="items-center rounded-[24px] bg-card px-6 py-6">
							<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
							<Text className="mt-3 text-center font-poppins text-body-3 text-text/70">
								Lernplan wird aktualisiert.
							</Text>
						</View>
					) : null}
					{snapshot?.sessions.map((session) => (
						<SessionCard
							key={session.id}
							session={session}
							onEdit={() => openEdit(session)}
						/>
					))}
				</View>
				{errorMessage ? (
					<Text className="mb-4 font-poppins text-body-4 text-destructive">
						{errorMessage}
					</Text>
				) : null}
			</ScrollView>

			<View
				pointerEvents="box-none"
				className="absolute right-0 bottom-0 left-0 flex-row items-center px-10"
				style={{ gap: 12, paddingBottom: Math.max(insets.bottom + 24, 36) }}
			>
				<Button
					accessibilityLabel={
						isBusy || isReplanning
							? "Lernplan eintragen, wird geladen"
							: "Lernplan eintragen"
					}
					accessibilityLiveRegion={
						isBusy || isReplanning ? "polite" : undefined
					}
					accessibilityState={{
						busy: isBusy || isReplanning,
						disabled: planActionsDisabled,
					}}
					disabled={planActionsDisabled}
					onPress={acceptGeneratedPlan}
					variant="neutral"
					className="h-14 flex-1"
					style={{ minWidth: 0 }}
				>
					{isBusy ? (
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
					) : (
						<Text className="font-poppins font-semibold text-body-3 text-white">
							Lernplan eintragen
						</Text>
					)}
				</Button>
				<TouchableOpacity
					accessibilityLabel="Lerntag hinzufügen"
					accessibilityRole="button"
					accessibilityState={{
						disabled: planActionsDisabled,
					}}
					activeOpacity={0.86}
					disabled={planActionsDisabled}
					onPress={addRecommendedSession}
					className="h-14 w-14 items-center justify-center rounded-full bg-primary"
					style={{
						shadowColor: "#00BAFF",
						shadowOpacity: 0.32,
						shadowRadius: 16,
						shadowOffset: { width: 0, height: 7 },
						elevation: 5,
						opacity: planActionsDisabled ? 0.55 : 1,
					}}
				>
					<Plus size={28} color="#FFFFFF" strokeWidth={2.4} />
				</TouchableOpacity>
			</View>
		</View>
	);
}
