import { View } from "react-native";
import { Check, Plus, X } from "~/components/ui/icon";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function SearchSelectionChip({
	title,
	onRemove,
	disabled = false,
}: {
	title: string;
	onRemove: () => void;
	disabled?: boolean;
}) {
	const { colors } = useDayovaTheme();
	return (
		<ActionSurface
			accessibilityRole="button"
			accessibilityLabel={`${title} entfernen`}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onRemove}
			className="min-h-12 max-w-full flex-row items-center gap-2 rounded-full border border-border bg-card px-4 py-2"
		>
			<Text className="shrink font-poppins text-body-3 text-text">{title}</Text>
			<View accessible={false} importantForAccessibility="no-hide-descendants">
				<X size={16} color={colors.text} />
			</View>
		</ActionSurface>
	);
}

export function SearchSuggestion({
	title,
	detail,
	hint,
	selected,
	disabled,
	onPress,
	checkColor,
	className,
	custom = false,
	customLabel,
}: {
	title: string;
	custom?: boolean;
	customLabel?: string;
	detail?: string;
	hint?: string;
	selected: boolean;
	disabled: boolean;
	onPress: () => void;
	checkColor: string;
	className?: string;
}) {
	return (
		<ActionSurface
			accessibilityRole="checkbox"
			accessibilityLabel={title}
			accessibilityHint={hint}
			accessibilityState={{ checked: selected, disabled }}
			disabled={disabled}
			onPress={onPress}
			className={cn(
				"min-h-14 flex-row items-center gap-3 py-3",
				custom
					? "rounded-full bg-card px-4"
					: "rounded-none bg-transparent px-1",
				className,
			)}
		>
			<View className="flex-1 gap-1">
				<Text
					className={cn(
						"font-poppins text-body-2 text-text",
						!custom && "font-semibold",
					)}
				>
					{custom
						? (customLabel ??
							(selected
								? `„${title}“ ausgewählt`
								: `„${title}“ als eigenes Thema hinzufügen`))
						: title}
				</Text>
				{detail && !custom ? (
					<Text className="font-poppins text-body-4 text-secondary-text">
						{detail}
					</Text>
				) : null}
			</View>
			<View
				accessible={false}
				importantForAccessibility="no-hide-descendants"
				className="h-8 w-8 items-center justify-center rounded-full border border-secondary-text"
			>
				{selected ? (
					<Check size={20} color={checkColor} />
				) : (
					<Plus size={20} color={checkColor} />
				)}
			</View>
		</ActionSurface>
	);
}
