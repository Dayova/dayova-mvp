import { TouchableOpacity, type TouchableOpacityProps } from "react-native";
import { X } from "~/components/ui/icon";
import { useDayovaTheme } from "~/lib/theme";

type CloseButtonProps = Omit<
	TouchableOpacityProps,
	"children" | "className" | "style"
> & { compact?: boolean };

function CloseButton({
	accessibilityLabel = "Schließen",
	activeOpacity = 0.75,
	hitSlop = 8,
	compact = false,
	...props
}: CloseButtonProps) {
	const { colors } = useDayovaTheme();

	return (
		<TouchableOpacity
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			activeOpacity={activeOpacity}
			hitSlop={hitSlop}
			className="h-10 w-10 items-center justify-center rounded-full border border-border bg-path-2"
			{...props}
		>
			<X size={compact ? 20 : 24} color={colors.path3} strokeWidth={2} />
		</TouchableOpacity>
	);
}

export { CloseButton };
