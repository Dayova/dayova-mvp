import { TouchableOpacity, type TouchableOpacityProps } from "react-native";
import { X } from "~/components/ui/icon";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

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
			className={cn(
				"items-center justify-center rounded-full bg-path-2",
				compact ? "h-8 w-8" : "h-10 w-10 shadow-black/10 shadow-sm",
			)}
			{...props}
		>
			<X size={compact ? 20 : 24} color={colors.path3} strokeWidth={2} />
		</TouchableOpacity>
	);
}

export { CloseButton };
