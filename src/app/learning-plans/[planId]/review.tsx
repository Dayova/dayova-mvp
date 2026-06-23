import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
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
import { ActionModal } from "~/components/ui/action-modal";
import { Button } from "~/components/ui/button";
import { Check, CircleAlert, Plus } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import {
	SectionTitle,
	SessionCard,
} from "~/features/learning-plans/learning-plan-ui";
import type {
	LearningPlanSnapshot,
	PlanSession,
} from "~/features/learning-plans/types";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { goBackOrReplace } from "~/lib/navigation";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export default function LearningPlanReviewScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const addSession = useMutation(api.learningPlans.addSession);
	const acceptPlan = useMutation(api.learningPlans.acceptPlan);

	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successDayKey, setSuccessDayKey] = useState<string | null>(null);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	useEffect(() => {
		if (!planId || !snapshot) return;

		if (
			snapshot.plan.status === "draft" ||
			snapshot.plan.status === "questionsReady"
		) {
			router.replace(planPath(planId, "analysis"));
		}
	}, [planId, router, snapshot]);

	const runWithErrorHandling = async (
		fallback: string,
		task: () => Promise<void>,
	) => {
		setIsBusy(true);
		setErrorMessage(null);
		try {
			await task();
		} catch (error) {
			setErrorMessage(getErrorMessage(error, fallback));
		} finally {
			setIsBusy(false);
		}
	};

	const openEdit = (session: PlanSession) => {
		if (!planId) return;
		router.push(`/learning-plans/${planId}/sessions/${session.id}/edit`);
	};

	const acceptGeneratedPlan = async () => {
		if (!planId || isBusy) return;

		await runWithErrorHandling(
			"Der Lernplan konnte nicht eingetragen werden.",
			async () => {
				const dayKey = await acceptPlan({ learningPlanId: planId });
				setSuccessDayKey(dayKey);
			},
		);
	};

	const addRecommendedSession = async () => {
		if (!planId || isBusy) return;

		await runWithErrorHandling(
			"Der zusätzliche Lerntag konnte nicht erstellt werden.",
			async () => {
				await addSession({ learningPlanId: planId });
			},
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
					<View className="mb-6 flex-row gap-4 rounded-[24px] bg-card px-6 py-5">
						<CircleAlert
							size={20}
							color={DAYOVA_DESIGN_SYSTEM.colors.warning}
							strokeWidth={2.2}
						/>
						<Text className="flex-1 font-poppins text-body-4 text-warning-foreground">
							{snapshot.plan.planningHint}
						</Text>
					</View>
				) : null}
				<View className="flex-1 gap-6">
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
						isBusy ? "Lernplan eintragen, wird geladen" : "Lernplan eintragen"
					}
					accessibilityLiveRegion={isBusy ? "polite" : undefined}
					accessibilityState={{
						busy: isBusy,
						disabled: isBusy || !snapshot?.sessions.length,
					}}
					disabled={isBusy || !snapshot?.sessions.length}
					onPress={acceptGeneratedPlan}
					variant="neutral"
					className="h-14 flex-1"
					style={{ minWidth: 0 }}
				>
					{isBusy ? (
						<ActivityIndicator
							color={DAYOVA_DESIGN_SYSTEM.colors.buttonNeutralForeground}
						/>
					) : (
						<Text className="font-poppins font-semibold text-body-3 text-button-neutral-foreground">
							Lernplan eintragen
						</Text>
					)}
				</Button>
				<TouchableOpacity
					accessibilityLabel="Lerntag hinzufügen"
					accessibilityRole="button"
					accessibilityState={{
						disabled: isBusy || !snapshot?.sessions.length,
					}}
					activeOpacity={0.86}
					disabled={isBusy || !snapshot?.sessions.length}
					onPress={addRecommendedSession}
					className="h-14 w-14 items-center justify-center rounded-full bg-primary"
					style={{
						shadowColor: "#00BAFF",
						shadowOpacity: 0.32,
						shadowRadius: 16,
						shadowOffset: { width: 0, height: 7 },
						elevation: 5,
						opacity: isBusy || !snapshot?.sessions.length ? 0.55 : 1,
					}}
				>
					<Plus size={28} color="#FFFFFF" strokeWidth={2.4} />
				</TouchableOpacity>
			</View>

			<ActionModal
				visible={Boolean(successDayKey)}
				title="Lernplan ist eingetragen"
				description="Dein Lernplan wurde erfolgreich eingetragen."
				icon={<Check size={48} color="#34C759" strokeWidth={1.2} />}
			>
				<Button
					className="mt-6 w-full"
					onPress={() =>
						router.replace(
							`/home${successDayKey ? `?dayKey=${encodeURIComponent(successDayKey)}` : ""}`,
						)
					}
				>
					<Text>Fertig</Text>
				</Button>
			</ActionModal>
		</View>
	);
}
