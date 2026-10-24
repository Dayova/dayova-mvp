import { useEffect, useRef } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

export type AccountDeletionRequest = {
	run: () => Promise<unknown>;
	resolve: (result: unknown) => void;
	reject: (error: unknown) => void;
};

export function AccountDeletionTransition({
	request,
	recovery,
	isRetrying,
	onSignOut,
}: {
	request: AccountDeletionRequest;
	recovery: { accepted: boolean; message: string; canReturn: boolean } | null;
	isRetrying: boolean;
	onSignOut: () => void;
}) {
	const started = useRef(false);
	const insets = useSafeAreaInsets();
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		// Start only after the protected providers/screens have unmounted.
		void request.run().then(request.resolve, request.reject);
	}, [request]);

	return (
		<View className="flex-1 bg-background">
			<ThemedStatusBar />
			<ScrollView
				contentContainerStyle={{
					flexGrow: 1,
					justifyContent: "center",
					paddingHorizontal: 28,
					paddingTop: insets.top + 24,
					paddingBottom: insets.bottom + 24,
				}}
			>
				<View className="w-full max-w-md gap-6 self-center">
					<View className="gap-3" accessibilityLiveRegion="polite">
						<Text variant="h1">
							{recovery
								? recovery.accepted
									? "Löschauftrag erhalten"
									: "Kontolöschung nicht bestätigt"
								: "Kontolöschung wird bestätigt …"}
						</Text>
						<Text className="text-center text-secondary-text">
							{recovery?.message ?? "Du wirst gleich abgemeldet."}
						</Text>
						{recovery && !recovery.accepted && !recovery.canReturn ? (
							<Text className="text-center text-secondary-text">
								Melde dich erneut an, um deinen Kontostatus zu prüfen.
							</Text>
						) : null}
					</View>
					{!recovery || isRetrying ? (
						<ActivityIndicator
							accessibilityLabel="Abmeldung läuft"
							color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						/>
					) : null}
					{recovery ? (
						<Button
							onPress={onSignOut}
							disabled={isRetrying}
							accessibilityState={{ disabled: isRetrying, busy: isRetrying }}
						>
							<Text className="text-on-primary">
								{recovery.canReturn ? "Zurück" : "Zur Anmeldung"}
							</Text>
						</Button>
					) : null}
				</View>
			</ScrollView>
		</View>
	);
}
