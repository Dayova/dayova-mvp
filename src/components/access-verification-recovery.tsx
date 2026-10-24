import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { SupportContact } from "~/components/ui/support-contact";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

export function AccessVerificationRecovery({
	isRetrying,
	onRetry,
}: {
	isRetrying: boolean;
	onRetry: () => void;
}) {
	const insets = useSafeAreaInsets();
	return (
		<ScrollView
			// Native ScrollView content geometry and device insets use the native style API.
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
					<Text variant="h1" selectable>
						Zugang gerade nicht prüfbar
					</Text>
					<Text className="text-center text-secondary-text" selectable>
						Wir können deinen Zugang gerade nicht bestätigen. Prüfe deine
						Internetverbindung und versuche es erneut.
					</Text>
				</View>
				<Button
					accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
					disabled={isRetrying}
					onPress={onRetry}
					className="gap-3"
				>
					{isRetrying ? (
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.onPrimary} />
					) : null}
					<Text className="text-on-primary">
						{isRetrying ? "Zugang wird geprüft …" : "Erneut prüfen"}
					</Text>
				</Button>
				<SupportContact context="Zugangsprüfung" />
			</View>
		</ScrollView>
	);
}
