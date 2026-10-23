import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedbackPressable } from "~/components/ui/feedback-pressable";
import { Text } from "~/components/ui/text";

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
				<FeedbackPressable
					accessibilityRole="button"
					accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
					disabled={isRetrying}
					onPress={onRetry}
					className="min-h-14 flex-row items-center justify-center gap-3 rounded-button bg-primary px-6 py-3"
				>
					{isRetrying ? <ActivityIndicator color="white" /> : null}
					<Text className="font-semibold text-white">
						{isRetrying ? "Zugang wird geprüft …" : "Erneut prüfen"}
					</Text>
				</FeedbackPressable>
			</View>
		</ScrollView>
	);
}
