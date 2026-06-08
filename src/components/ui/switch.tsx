import { Host, Switch as ExpoSwitch } from "@expo/ui";
import type { SwitchProps } from "~/components/ui/switch.types";

function Switch({ value, onValueChange, disabled, testID }: SwitchProps) {
	return (
		<Host matchContents>
			<ExpoSwitch
				value={value}
				disabled={disabled}
				onValueChange={onValueChange}
				testID={testID}
			/>
		</Host>
	);
}

export { Switch };
