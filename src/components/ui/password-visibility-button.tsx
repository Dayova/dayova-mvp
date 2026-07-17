import { Pressable } from "react-native";
import { Eye, EyeOff } from "~/components/ui/icon";
import { useDayovaTheme } from "~/lib/theme";

// The icon describes the current state: closed eye = hidden, open eye = shown.
// Decision: https://app.notion.com/p/39f2e87228bf81c28511c0728134c774
export function PasswordVisibilityButton({
	fieldLabel,
	visible,
	onToggle,
}: {
	fieldLabel: string;
	visible: boolean;
	onToggle: () => void;
}) {
	const { colors } = useDayovaTheme();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${fieldLabel} ${visible ? "ausblenden" : "anzeigen"}`}
			hitSlop={10}
			onPress={onToggle}
			className="h-10 w-10 items-center justify-center"
		>
			{visible ? (
				<Eye size={19} color={colors.secondaryText} strokeWidth={2} />
			) : (
				<EyeOff size={19} color={colors.secondaryText} strokeWidth={2} />
			)}
		</Pressable>
	);
}
