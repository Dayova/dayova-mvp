import { Host, Switch as ExpoSwitch } from "@expo/ui";
import { tint } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import type { SwitchProps } from "~/components/ui/switch.types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const switchModifiers = [tint(DAYOVA_DESIGN_SYSTEM.colors.primary)];

function Switch({
	value,
	onValueChange,
	disabled,
	testID,
	accessibilityLabel,
}: SwitchProps) {
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
			<Host matchContents>
				<ExpoSwitch
					value={value}
					disabled={disabled}
					onValueChange={onValueChange}
					testID={testID}
					modifiers={switchModifiers}
				/>
			</Host>
		</View>
	);
}

export { Switch };
