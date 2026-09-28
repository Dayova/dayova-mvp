import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { AddIcon } from "~/components/ui/add-icon";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";

export function CreateEntryButton({ returnTo }: { returnTo: string }) {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel="Lernplan erstellen"
			accessibilityHint="Öffnet direkt die Lernplan-Erstellung."
			activeOpacity={0.88}
			onPress={() => {
				trackFeature("home.create_opened");
				trackFeature("home.create_exam_selected");
				router.push(withReturnTo(ROUTES.createExam, returnTo));
			}}
			className="h-12 w-12 items-center justify-center rounded-full active:opacity-80"
		>
			<AddIcon outlinedGradient />
		</TouchableOpacity>
	);
}
