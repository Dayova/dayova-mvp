import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { PreparationSlot } from "#convex/preparationSchedule";
import { berlinNow, timeLabel } from "#convex/preparationSchedule";
import { BackButton, Button } from "~/components/ui/button";
import { Time04 } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { PreparationSlotEditor } from "~/features/learning-plans/preparation-slot-editor";
import { getErrorMessage } from "~/features/learning-plans/utils";
export default function LearningPlanReviewScreen() {
	const { planId } = useLocalSearchParams<{ planId: string }>();
	const id = planId as Id<"learningPlans">;
	const router = useRouter();
	const { isAuthenticated } = useConvexAuth();
	const snapshot = useQuery(
		api.learningPlans.getSnapshot,
		isAuthenticated && id ? { id } : "skip",
	);
	const accept = useMutation(api.learningPlans.acceptDiagnostic);
	const legacyAccept = useMutation(api.learningPlans.acceptPlan);
	const [busy, setBusy] = useState(false);
	const acceptingRef = useRef(false);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);
	useEffect(() => {
		if (snapshot?.plan.status === "accepted" && !acceptingRef.current)
			router.replace(`/learning-plans/${id}`);
	}, [snapshot?.plan.status, id, router]);
	const commit = async (slot?: PreparationSlot, openPlan = false) => {
		if (busy || !snapshot) return;
		setBusy(true);
		acceptingRef.current = true;
		setError(null);
		try {
			let sessionId = snapshot.sessions[0]?.id;
			if (snapshot.plan.preparationState)
				sessionId = await accept({
					learningPlanId: id,
					appointment: slot
						? { dateKey: slot.dateKey, startTime: slot.startTime }
						: undefined,
				});
			else await legacyAccept({ learningPlanId: id });
			router.replace(
				slot || openPlan || !sessionId
					? `/learning-plans/${id}`
					: `/learning-plans/${id}/sessions/${sessionId}`,
			);
		} catch (cause) {
			acceptingRef.current = false;
			setError(
				getErrorMessage(
					cause,
					"Dein Wissenscheck konnte nicht gestartet werden.",
				),
			);
		} finally {
			setBusy(false);
		}
	};
	const now = berlinNow();
	const preferred = snapshot?.sessions[0];
	const dateKey =
		preferred && preferred.dateKey.slice(0, 10) > now.dateKey
			? preferred.dateKey.slice(0, 10)
			: now.dateKey;
	return (
		<Screen>
			<ScreenScroll contentContainerStyle={{ flexGrow: 1 }} includeTopSafeArea>
				<BackButton onPress={() => router.replace("/learning-plans")} />
				<View className="flex-1 items-center justify-center gap-5 py-10">
					<View className="h-20 w-20 items-center justify-center rounded-full bg-system-subtle">
						<Time04 size={34} color="#00A0E6" />
					</View>
					<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
						Was kannst du schon?
					</Text>
					<Text className="max-w-[340px] text-center font-poppins text-body-3 text-secondary-text">
						Zehn kurze Fragen zeigen deine Stärken und Übungsschwerpunkte.
						Danach stehen deine Lerntermine bereit.
					</Text>
				</View>
				{error ? (
					<Text accessibilityRole="alert" className="mb-4 text-destructive">
						{error}
					</Text>
				) : null}
				<View className="gap-3 pb-6">
					<Button disabled={!snapshot || busy} onPress={() => void commit()}>
						{busy ? (
							<ActivityIndicator color="white" />
						) : (
							<Text>Jetzt starten</Text>
						)}
					</Button>
					<Button
						disabled={!snapshot || busy}
						variant="cancel"
						onPress={() =>
							snapshot?.plan.preparationState
								? setEditing(true)
								: void commit(undefined, true)
						}
					>
						<Text>
							{snapshot?.plan.preparationState
								? "Termin wählen"
								: "Plan übernehmen"}
						</Text>
					</Button>
				</View>
			</ScreenScroll>
			{editing && snapshot ? (
				<PreparationSlotEditor
					diagnostic
					slot={{
						id: "diagnostic",
						dateKey,
						startTime:
							dateKey === now.dateKey
								? timeLabel(
										Math.min(1425, Math.ceil((now.minutes + 15) / 5) * 5),
									)
								: (preferred?.startTime ?? "17:00"),
						durationMinutes: 10,
					}}
					examDateKey={snapshot.plan.examDateKey}
					onSave={(slot) => void commit(slot)}
					onClose={() => setEditing(false)}
				/>
			) : null}
		</Screen>
	);
}
