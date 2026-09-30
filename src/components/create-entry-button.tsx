import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { AddIcon } from "~/components/ui/add-icon";
import { ROUTES, withReturnTo } from "~/lib/routes";

export function CreateEntryButton({ returnTo }: { returnTo: string }) {
	const router = useRouter();
	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel="Lernplan erstellen"
			accessibilityHint="Öffnet direkt die Lernplan-Erstellung."
			activeOpacity={0.88}
			onPress={() => router.push(withReturnTo(ROUTES.createExam, returnTo))}
			className="h-12 w-12 items-center justify-center rounded-full active:opacity-80"
		>
			<AddIcon outlinedGradient />
		</TouchableOpacity>
	);
}
