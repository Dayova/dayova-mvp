import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { CreateEntryIcon } from "~/components/ui/create-entry-icon";
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
			className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
		>
			<CreateEntryIcon />
		</TouchableOpacity>
	);
}
