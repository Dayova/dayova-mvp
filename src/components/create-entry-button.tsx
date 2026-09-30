import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Plus } from "~/components/ui/icon";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";

export function CreateEntryButton({ returnTo }: { returnTo: string }) {
	const router = useRouter();
	const { colors } = useDayovaTheme();
	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel="Lernplan erstellen"
			accessibilityHint="Öffnet direkt die Lernplan-Erstellung."
			activeOpacity={0.88}
			onPress={() => router.push(withReturnTo(ROUTES.createExam, returnTo))}
			className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
		>
			<Plus size={28} color={colors.primary} strokeWidth={1.8} />
		</TouchableOpacity>
	);
}
