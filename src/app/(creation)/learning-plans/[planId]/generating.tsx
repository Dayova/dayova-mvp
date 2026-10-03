import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { getErrorMessage } from "~/features/learning-plans/utils";
export default function LearningPlanGeneratingScreen() {
	const { planId } = useLocalSearchParams<{ planId: string }>();
	const id = planId as Id<"learningPlans">;
	const router = useRouter();
	const { isAuthenticated } = useConvexAuth();
	const snapshot = useQuery(
		api.learningPlans.getSnapshot,
		isAuthenticated && id ? { id } : "skip",
	);
	const prepare = useMutation(api.learningPlans.prepareDiagnostic);
	const started = useRef(false);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		void attempt;
		if (!snapshot || !id) return;
		if (
			snapshot.plan.status === "generated" ||
			snapshot.plan.status === "accepted"
		) {
			router.replace(`/learning-plans/${id}/review`);
			return;
		}
		if (snapshot.plan.diagnosticPlacement !== "firstSession") {
			router.replace(`/learning-plans/${id}/analysis`);
			return;
		}
		if (started.current) return;
		started.current = true;
		void prepare({ learningPlanId: id }).catch((cause) =>
			setError(
				getErrorMessage(
					cause,
					"Dein Wissenscheck konnte nicht vorbereitet werden.",
				),
			),
		);
	}, [snapshot, id, prepare, router, attempt]);
	return (
		<Screen>
			<View className="flex-1 items-center justify-center gap-5 px-6">
				<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
					Dein Wissenscheck wird vorbereitet
				</Text>
				{error ? (
					<>
						<Text
							accessibilityRole="alert"
							className="text-center text-destructive"
						>
							{error}
						</Text>
						<Button
							onPress={() => {
								started.current = false;
								setError(null);
								setAttempt((v) => v + 1);
							}}
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
		</Screen>
	);
}
