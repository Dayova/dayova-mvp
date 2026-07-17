import {
	Switch as ComposeSwitch,
	Host,
	type SwitchColors,
} from "@expo/ui/jetpack-compose";
import { testID as testIDModifier } from "@expo/ui/jetpack-compose/modifiers";
import { useMemo } from "react";
import { View } from "react-native";
import type { SwitchProps } from "~/components/ui/switch.types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

const DAYOVA_PRIMARY = DAYOVA_DESIGN_SYSTEM.colors.primary;

// expo-modules-core >= 56.0.18 keeps this composition alive until the
// react-native-screens pop transition finishes: https://github.com/expo/expo/pull/47099
function Switch({
	value,
	onValueChange,
	disabled,
	testID,
	accessibilityLabel,
}: SwitchProps) {
	const { colors, resolvedTheme } = useDayovaTheme();
	const switchColors = useMemo(
		() =>
			({
				checkedThumbColor: colors.surface,
				checkedTrackColor: DAYOVA_PRIMARY,
				checkedBorderColor: DAYOVA_PRIMARY,
				uncheckedThumbColor: colors.secondaryText,
				uncheckedTrackColor: colors.mutedSurface,
				uncheckedBorderColor: colors.border,
				disabledCheckedThumbColor: colors.surface,
				disabledCheckedTrackColor: colors.primaryAccent,
				disabledCheckedBorderColor: colors.primaryAccent,
				disabledUncheckedThumbColor: colors.path3,
				disabledUncheckedTrackColor: colors.mutedSurface,
				disabledUncheckedBorderColor: colors.border,
			}) satisfies SwitchColors,
		[colors],
	);

	return (
		<View
			accessible
			accessibilityActions={disabled ? undefined : [{ name: "activate" }]}
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="switch"
			accessibilityState={{ checked: value, disabled }}
			onAccessibilityAction={({ nativeEvent: { actionName } }) => {
				if (actionName === "activate" && !disabled) onValueChange(!value);
			}}
		>
			<Host
				colorScheme={resolvedTheme}
				matchContents
				seedColor={DAYOVA_PRIMARY}
			>
				<ComposeSwitch
					value={value}
					enabled={!disabled}
					onCheckedChange={disabled ? undefined : onValueChange}
					colors={switchColors}
					modifiers={testID ? [testIDModifier(testID)] : undefined}
				/>
			</Host>
		</View>
	);
}

export { Switch };
