import { View } from "react-native";
import { CreateEntryButton } from "~/components/create-entry-button";
import { BackButton } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { ROUTES } from "~/lib/routes";

export function PlansPageHeader({ onBack }: { onBack?: () => void }) {
	return (
		<View className="min-h-12 flex-row items-center justify-between gap-6">
			{onBack ? (
				<BackButton accessibilityLabel="Zurück zu Heute" onPress={onBack} />
			) : null}
			<Text
				accessibilityRole="header"
				className="min-w-0 flex-1 font-poppins font-semibold text-heading-2 text-text"
			>
				Deine Pläne
			</Text>
			<View className="shrink-0">
				<CreateEntryButton returnTo={ROUTES.learningPlans} />
			</View>
		</View>
	);
}
