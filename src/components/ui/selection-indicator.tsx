import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { Check } from "~/components/ui/icon";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

export function SelectionIndicator({ selected }: { selected: boolean }) {
	return (
		<View
			accessible={false}
			className="h-6 w-6 shrink-0 overflow-hidden rounded-full"
		>
			{selected ? (
				<LinearGradient
					{...DAYOVA_DESIGN_SYSTEM.gradients.selection}
					// LinearGradient exposes its native geometry through style.
					style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
				>
					<Check
						size={14}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2.5}
					/>
				</LinearGradient>
			) : (
				<View className="h-6 w-6 rounded-full border-2 border-primary/40" />
			)}
		</View>
	);
}
