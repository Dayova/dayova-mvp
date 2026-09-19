import { useMutation } from "convex/react";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

export function NextSessionRecovery({
	planId,
}: {
	planId: Id<"learningPlans">;
}) {
	const router = useRouter();
	const restoreNextSession = useMutation(api.learningPlans.restoreNextSession);
	const busy = useRef(false);
	const [state, setState] = useState<"loading" | "unavailable" | "failed">(
		"loading",
	);
	const restore = useCallback(async () => {
		if (busy.current) return;
		busy.current = true;
		setState("loading");
		try {
			const restored = await restoreNextSession({ learningPlanId: planId });
			if (!restored) setState("unavailable");
		} catch {
			setState("failed");
		} finally {
			busy.current = false;
		}
	}, [planId, restoreNextSession]);
	useFocusEffect(
		useCallback(() => {
			void restore();
		}, [restore]),
	);

	return (
		<View className="gap-3 rounded-card border border-border bg-card p-4">
			<Text
				accessibilityRole="header"
				className="font-poppins font-semibold text-body-2 text-text"
			>
				Dein nächster Lernschritt
			</Text>
			{state === "loading" ? (
				<View accessibilityState={{ busy: true }} className="gap-3">
					<ActivityIndicator
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						accessibilityLabel="Nächster Lernschritt wird geplant"
					/>
					<Text className="font-poppins text-body-3 text-secondary-text">
						Dayova plant deinen nächsten Lerntermin.
					</Text>
				</View>
			) : state === "failed" ? (
				<>
					<Text
						accessibilityRole="alert"
						className="font-poppins text-body-3 text-secondary-text"
					>
						Der nächste Lernschritt konnte nicht geplant werden. Versuche es
						noch einmal.
					</Text>
					<Button onPress={() => void restore()}>
						<Text>Erneut versuchen</Text>
					</Button>
				</>
			) : (
				<>
					<Text className="font-poppins text-body-3 text-secondary-text">
						Aktuell ist kein weiterer Lerntermin verfügbar. Prüfe deine
						Lernzeiten vor der Prüfung.
					</Text>
					<Button onPress={() => router.push("/learning-times")}>
						<Text>Lernzeiten anpassen</Text>
					</Button>
				</>
			)}
		</View>
	);
}
