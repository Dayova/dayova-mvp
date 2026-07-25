import { Host, Switch as ExpoSwitch } from "@expo/ui";
import { View } from "react-native";
import type { SwitchProps } from "~/components/ui/switch.types";

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
				/>
			</Host>
		</View>
	);
}

export { Switch };
