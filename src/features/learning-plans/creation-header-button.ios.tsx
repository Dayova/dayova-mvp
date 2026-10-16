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
import type { CreationHeaderButtonProps } from "~/features/learning-plans/creation-header-button";
import { useDayovaTheme } from "~/lib/theme";

export function CreationHeaderButton({
	kind,
	onPress,
	disabled = false,
}: CreationHeaderButtonProps) {
	const { colors, isDark } = useDayovaTheme();
	const isBack = kind === "back";
	const Icon = isBack ? ArrowLeft : X;

	return (
		<Host
			colorScheme={isDark ? "dark" : "light"}
			// SwiftUI needs explicit native host bounds within the React Native row.
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
					accessibilityLabel(isBack ? "Zurück" : "Schließen"),
					accessibilityHint(
						isBack
							? "Geht zum vorherigen Schritt oder Bildschirm zurück."
							: "Verlässt die Lernplan-Erstellung.",
					),
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
