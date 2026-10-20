import * as Haptics from "expo-haptics";
import { Platform, View } from "react-native";
import type { Check } from "~/components/ui/icon";
import {
	SelectionControl,
	SelectionIndicator,
	SelectionText,
} from "~/components/ui/selection-control";
import { Text } from "~/components/ui/text";
import { triggerSelectionHaptic } from "~/lib/safe-haptics";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function SelectionOptionRow({
	Icon,
	label,
	description,
	selected,
	onPress,
	disabled = false,
	accessibilityRole = "radio",
	accessibilityLabel = label,
	accessibilityHint = description,
	className,
}: {
	Icon?: typeof Check;
	label: string;
	description?: string;
	selected: boolean;
	onPress: () => void;
	disabled?: boolean;
	accessibilityRole?: "radio" | "checkbox";
	accessibilityLabel?: string;
	accessibilityHint?: string;
	className?: string;
}) {
	const { colors } = useDayovaTheme();

	return (
		<SelectionControl
			selected={selected}
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			accessibilityRole={accessibilityRole}
			accessibilityState={{ checked: selected, disabled }}
			disabled={disabled}
			className={className}
			contentClassName="min-h-16 flex-row items-center gap-4 rounded-3xl px-5 py-3"
			onPress={() => {
				if (!selected) {
					void triggerSelectionHaptic({
						platform: Platform.OS,
						selectionAsync: Haptics.selectionAsync,
					});
				}
				onPress();
			}}
		>
			{Icon ? (
				<View
					accessible={false}
					className="h-9 w-9 items-center justify-center rounded-full bg-system-subtle"
				>
					<Icon
						size={20}
						color={selected ? colors.primary : colors.secondaryText}
						strokeWidth={2}
					/>
				</View>
			) : null}
			<View className="flex-1">
				<SelectionText
					className={cn(
						"font-poppins text-body-2",
						selected && "font-semibold",
					)}
				>
					{label}
				</SelectionText>
				{description ? (
					<Text className="text-body-4 text-secondary-text">{description}</Text>
				) : null}
			</View>
			<SelectionIndicator />
		</SelectionControl>
	);
}
