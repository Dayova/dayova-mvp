import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { Plus } from "~/components/ui/icon";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

/** Shared visual for add actions; the surrounding control supplies its label. */
export function AddIcon({
	emphasized = false,
	gradient = false,
}: {
	emphasized?: boolean;
	gradient?: boolean;
}) {
	const { colors } = useDayovaTheme();
	return (
		<View
			pointerEvents="none"
			className={cn(
				"h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full",
				emphasized ? "bg-secondary-text" : "bg-primary/10",
			)}
		>
			{gradient ? (
				<LinearGradient
					colors={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors}
					start={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start}
					end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
					style={StyleSheet.absoluteFill}
				/>
			) : null}
			<Plus
				size={22}
				color={
					gradient ? "#FFFFFF" : emphasized ? colors.background : colors.primary
				}
				strokeWidth={2.2}
			/>
		</View>
	);
}
