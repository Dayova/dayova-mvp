import {
	Host,
	Switch as ComposeSwitch,
	type SwitchColors,
} from "@expo/ui/jetpack-compose";
import { testID as testIDModifier } from "@expo/ui/jetpack-compose/modifiers";
import type { SwitchProps } from "~/components/ui/switch.types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const DAYOVA_BLUE = DAYOVA_DESIGN_SYSTEM.colors.primary;

const switchColors = {
	checkedThumbColor: "#FFFFFF",
	checkedTrackColor: DAYOVA_BLUE,
	checkedBorderColor: DAYOVA_BLUE,
	uncheckedThumbColor: "#8C8F98",
	uncheckedTrackColor: "#F7F8FA",
	uncheckedBorderColor: "#CDD3DF",
	disabledCheckedThumbColor: "#FFFFFF",
	disabledCheckedTrackColor: "#A9C4FF",
	disabledCheckedBorderColor: "#A9C4FF",
	disabledUncheckedThumbColor: "#B8BEC9",
	disabledUncheckedTrackColor: "#ECEEF3",
	disabledUncheckedBorderColor: "#D7DBE3",
} satisfies SwitchColors;

function Switch({ value, onValueChange, disabled, testID }: SwitchProps) {
	return (
		<Host matchContents seedColor={DAYOVA_BLUE}>
			<ComposeSwitch
				value={value}
				enabled={!disabled}
				onCheckedChange={disabled ? undefined : onValueChange}
				colors={switchColors}
				modifiers={testID ? [testIDModifier(testID)] : undefined}
			/>
		</Host>
	);
}

export { Switch };
