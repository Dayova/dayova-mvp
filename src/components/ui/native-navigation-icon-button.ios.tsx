import { Button, Host, RNHostView } from "@expo/ui";
import {
	accessibilityHint,
	accessibilityLabel,
	buttonBorderShape,
	buttonStyle,
	controlSize,
} from "@expo/ui/swift-ui/modifiers";
import { Platform, View } from "react-native";
import { ArrowLeft, X } from "~/components/ui/icon";
import { useDayovaTheme } from "~/lib/theme";

type NativeNavigationIconButtonProps = {
	kind: "back" | "close";
	onPress: () => void;
	disabled?: boolean;
	accessibilityLabel?: string;
	accessibilityHint?: string;
};

export function NativeNavigationIconButton({
	kind,
	onPress,
	disabled = false,
	accessibilityLabel: label = kind === "back" ? "Zurück" : "Schließen",
	accessibilityHint: hint,
}: NativeNavigationIconButtonProps) {
	const { colors, isDark } = useDayovaTheme();
	const Icon = kind === "back" ? ArrowLeft : X;

	return (
		<Host
			colorScheme={isDark ? "dark" : "light"}
			// SwiftUI needs explicit host bounds inside React Native sheet/header rows.
			style={{ width: 48, height: 48 }}
		>
			<Button
				onPress={onPress}
				disabled={disabled}
				modifiers={[
					buttonStyle(
						Number.parseInt(String(Platform.Version), 10) >= 26
							? "glass"
							: "bordered",
					),
					buttonBorderShape("circle"),
					controlSize("large"),
					accessibilityLabel(label),
					...(hint ? [accessibilityHint(hint)] : []),
				]}
			>
				<RNHostView matchContents>
					<View
						accessible={false}
						pointerEvents="none"
						className="h-5 w-5 items-center justify-center"
					>
						<Icon size={20} color={colors.text} strokeWidth={2.4} />
					</View>
				</RNHostView>
			</Button>
		</Host>
	);
}
