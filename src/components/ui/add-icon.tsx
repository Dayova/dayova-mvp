import { View } from "react-native";
import { Plus } from "~/components/ui/icon";
import { useDayovaTheme } from "~/lib/theme";

/** Shared visual for add actions; the surrounding control supplies its label. */
export function AddIcon() {
	const { colors } = useDayovaTheme();
	return (
		<View
			pointerEvents="none"
			className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10"
		>
			<Plus size={22} color={colors.primary} strokeWidth={2.2} />
		</View>
	);
}
