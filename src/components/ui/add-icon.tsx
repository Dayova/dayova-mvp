import { View } from "react-native";
import { Plus } from "~/components/ui/icon";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

/** Shared visual for add actions; the surrounding control supplies its label. */
export function AddIcon({ emphasized = false }: { emphasized?: boolean }) {
	const { colors } = useDayovaTheme();
	return (
		<View
			pointerEvents="none"
			className={cn(
				"h-12 w-12 shrink-0 items-center justify-center rounded-full",
				emphasized ? "bg-button-neutral" : "bg-primary/10",
			)}
		>
			<Plus
				size={22}
				color={emphasized ? colors.background : colors.primary}
				strokeWidth={2.2}
			/>
		</View>
	);
}
