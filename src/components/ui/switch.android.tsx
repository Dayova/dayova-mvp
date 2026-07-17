import { Switch as NativeSwitch, View } from "react-native";
import type { SwitchProps } from "~/components/ui/switch.types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

const DAYOVA_PRIMARY = DAYOVA_DESIGN_SYSTEM.colors.primary;
const ANDROID_SWITCH_SCALE = 1.35;

function Switch({
	value,
	onValueChange,
	disabled,
	testID,
	accessibilityLabel,
}: SwitchProps) {
	const { colors } = useDayovaTheme();

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
			style={{
				alignItems: "center",
				height: 48,
				justifyContent: "center",
				width: 56,
			}}
		>
			<NativeSwitch
				accessible={false}
				disabled={disabled}
				importantForAccessibility="no"
				onValueChange={onValueChange}
				style={{
					transform: [
						{ scaleX: ANDROID_SWITCH_SCALE },
						{ scaleY: ANDROID_SWITCH_SCALE },
					],
				}}
				testID={testID}
				thumbColor={value ? colors.surface : colors.secondaryText}
				trackColor={{
					false: colors.mutedSurface,
					true: disabled ? colors.primaryAccent : DAYOVA_PRIMARY,
				}}
				value={value}
			/>
		</View>
	);
}

export { Switch };
