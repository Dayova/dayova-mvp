import { TouchableOpacity, type TouchableOpacityProps } from "react-native";
import { X } from "~/components/ui/icon";
import { useDayovaTheme } from "~/lib/theme";

type CloseButtonProps = Omit<
	TouchableOpacityProps,
	"children" | "className" | "style"
>;

function CloseButton({
	accessibilityLabel = "Schließen",
	activeOpacity = 0.75,
	hitSlop = 8,
	...props
}: CloseButtonProps) {
	const { colors } = useDayovaTheme();

	return (
		<TouchableOpacity
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			activeOpacity={activeOpacity}
			hitSlop={hitSlop}
			className="h-10 w-10 items-center justify-center rounded-full bg-path-2 shadow-black/10 shadow-sm"
			{...props}
		>
			<X size={24} color={colors.path3} strokeWidth={2} />
		</TouchableOpacity>
	);
}

export { CloseButton };
