import { Host, Switch as ExpoSwitch } from "@expo/ui";
import { tint } from "@expo/ui/swift-ui/modifiers";
import type { SwitchProps } from "~/components/ui/switch.types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const switchModifiers = [tint(DAYOVA_DESIGN_SYSTEM.colors.primary)];

function Switch({ value, onValueChange, disabled, testID }: SwitchProps) {
	return (
		<Host matchContents>
			<ExpoSwitch
				value={value}
				disabled={disabled}
				onValueChange={onValueChange}
				testID={testID}
				modifiers={switchModifiers}
			/>
		</Host>
	);
}

export { Switch };
