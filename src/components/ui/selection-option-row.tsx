import { Pressable, View } from "react-native";
import type { Check } from "~/components/ui/icon";
import { SelectionIndicator } from "~/components/ui/selection-indicator";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function SelectionOptionRow({
	Icon,
	label,
	description,
	selected,
	onPress,
}: {
	Icon: typeof Check;
	label: string;
	description?: string;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();

	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityHint={description}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			className={cn(
				"min-h-16 flex-row items-center gap-4 rounded-3xl border px-5 py-3 active:opacity-80",
				selected ? "border-primary/40 bg-accent" : "border-border bg-card",
			)}
			onPress={onPress}
		>
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
			<View className="flex-1">
				<Text
					className={cn(
						"font-poppins text-body-2",
						selected ? "font-semibold text-primary" : "text-text",
					)}
				>
					{label}
				</Text>
				{description ? (
					<Text className="text-body-4 text-secondary-text">{description}</Text>
				) : null}
			</View>
			<SelectionIndicator selected={selected} />
		</Pressable>
	);
}
