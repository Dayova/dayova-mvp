import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Plus } from "~/components/ui/icon";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function CreateEntryButton({
	compact = false,
	returnTo,
}: {
	compact?: boolean;
	returnTo: string;
}) {
	const router = useRouter();
	const { colors } = useDayovaTheme();
	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel="Lernplan erstellen"
			accessibilityHint="Öffnet direkt die Lernplan-Erstellung."
			activeOpacity={0.88}
			onPress={() => router.push(withReturnTo(ROUTES.createExam, returnTo))}
			className={cn(
				"items-center justify-center rounded-full border border-border bg-card",
				compact ? "h-11 w-11" : "h-12 w-12",
			)}
		>
			<Plus size={compact ? 24 : 28} color={colors.primary} strokeWidth={1.8} />
		</TouchableOpacity>
	);
}
