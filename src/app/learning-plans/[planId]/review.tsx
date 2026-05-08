import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Check, Plus } from "~/components/ui/icon";
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
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export default function LearningPlanReviewScreen() {
	const router = useRouter();
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

	useBackIntent(Boolean(planId), goBack);

	return (
		<View className="flex-1 bg-[#F5F3F6]">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					flexGrow: 1,
					paddingHorizontal: 32,
					paddingTop: 80,
					paddingBottom: 60,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Header title="Lernplan" onBack={goBack} showBack={false} />
				<SectionTitle
					title="Lernplan erstellen"
					description="Passe deine Lerntage an und trage den Plan danach in den Kalender ein."
				/>
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
					<Text className="mb-4 font-poppins text-12 text-destructive">
						{errorMessage}
					</Text>
				) : null}
				<View className="mt-auto flex-row items-center gap-3 pt-8">
					<Button
						accessibilityLabel={
							isBusy ? "Lernplan erstellen, wird geladen" : "Lernplan erstellen"
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
							<ActivityIndicator color="#1A1A1A" />
						) : (
							<Text className="font-bold font-poppins text-15 text-text">
								Lernplan erstellen
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
							shadowColor: "#3A7BFF",
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
			</ScrollView>

			<Modal visible={Boolean(successDayKey)} transparent animationType="fade">
				<View className="flex-1 justify-end">
					<View className="absolute inset-0 bg-black/30" />
					<View className="mx-8 mb-9 items-center rounded-[30px] bg-white px-5 pt-8 pb-5">
						<View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-green-100">
							<Check size={31} color="#28C76F" strokeWidth={1.9} />
						</View>
						<Text className="font-bold font-poppins text-18 text-text">
							Lernplan ist eingetragen
						</Text>
						<Text className="mt-2 text-center font-poppins text-12 text-text/45">
							Deine Lernplan wurde erfolgreich eingetragen.
						</Text>
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
					</View>
				</View>
			</Modal>
		</View>
	);
}
