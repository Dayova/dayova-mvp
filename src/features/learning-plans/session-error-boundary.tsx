import { ConvexError } from "convex/values";
import {
	type ErrorBoundaryProps,
	Stack,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import { useCallback, useEffect } from "react";
import { View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/components/ui/error-message";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { logDiagnosticError } from "~/lib/diagnostics";
import { dismissToOrReplace, useBackIntent } from "~/lib/navigation";
import { extractUserFacingErrorMessage } from "~/lib/user-facing-errors";
import { getLearningSessionBackTarget } from "./session-navigation";

// Expo Router catches render-time failures here, including reactive Convex
// query errors that cannot be caught by the preparation action's async handler.
export function LearningSessionErrorBoundary({
	error,
	retry,
}: ErrorBoundaryProps) {
	const router = useRouter();
	const { planId, returnTo } = useLocalSearchParams<{
		planId?: string;
		returnTo?: string;
	}>();
	const backTarget = getLearningSessionBackTarget(
		planId as Id<"learningPlans"> | undefined,
		returnTo,
	);
	const goBack = useCallback(() => {
		dismissToOrReplace(router, backTarget);
		return true;
	}, [backTarget, router]);
	useBackIntent(true, goBack);
	useEffect(() => {
		logDiagnosticError("Failed to open learning session.", error, {
			source: "learningSession.route",
		});
	}, [error]);
	const message =
		(error instanceof ConvexError
			? extractUserFacingErrorMessage(error)
			: null) ??
		"Der Lernblock konnte nicht geladen werden. Versuche es erneut oder gehe zurück.";
	return (
		<Screen>
			<Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
			<ThemedStatusBar />
			<ScreenScroll
				contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
			>
				<Text className="text-center font-poppins font-semibold text-body-1 text-text">
					Lernblock nicht verfügbar
				</Text>
				<ErrorMessage className="mt-4">{message}</ErrorMessage>
				<Text className="mt-4 text-center font-poppins text-body-3 text-secondary-text">
					Dein gespeicherter Lernfortschritt bleibt erhalten.
				</Text>
				<View className="mt-8 gap-3">
					<Button onPress={() => void retry()}>
						<Text>Erneut versuchen</Text>
					</Button>
					<Button variant="neutral" onPress={goBack}>
						<Text>Zurück</Text>
					</Button>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
