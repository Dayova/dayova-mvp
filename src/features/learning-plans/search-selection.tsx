import { View } from "react-native";
import { X } from "~/components/ui/icon";
import { SelectionOptionRow } from "~/components/ui/selection-option-row";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

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
	className?: string;
}) {
	return (
		<SelectionOptionRow
			accessibilityRole="checkbox"
			accessibilityLabel={title}
			accessibilityHint={hint}
			selected={selected}
			disabled={disabled}
			onPress={onPress}
			className={className}
			label={
				custom
					? (customLabel ??
						(selected
							? `„${title}“ ausgewählt`
							: `„${title}“ als eigenes Thema hinzufügen`))
					: title
			}
			description={custom ? undefined : detail}
		/>
	);
}
