import {
	Switch as ComposeSwitch,
	Host,
	type SwitchColors,
} from "@expo/ui/jetpack-compose";
import { testID as testIDModifier } from "@expo/ui/jetpack-compose/modifiers";
import type { SwitchProps } from "~/components/ui/switch.types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const DAYOVA_PRIMARY = DAYOVA_DESIGN_SYSTEM.colors.primary;

const switchColors = {
	checkedThumbColor: DAYOVA_DESIGN_SYSTEM.colors.surface,
	checkedTrackColor: DAYOVA_PRIMARY,
	checkedBorderColor: DAYOVA_PRIMARY,
	uncheckedThumbColor: DAYOVA_DESIGN_SYSTEM.colors.secondaryText,
	uncheckedTrackColor: DAYOVA_DESIGN_SYSTEM.colors.mutedSurface,
	uncheckedBorderColor: DAYOVA_DESIGN_SYSTEM.colors.border,
	disabledCheckedThumbColor: DAYOVA_DESIGN_SYSTEM.colors.surface,
	disabledCheckedTrackColor: DAYOVA_DESIGN_SYSTEM.colors.primaryAccent,
	disabledCheckedBorderColor: DAYOVA_DESIGN_SYSTEM.colors.primaryAccent,
	disabledUncheckedThumbColor: "#B8BEC9",
	disabledUncheckedTrackColor: "#ECEEF3",
	disabledUncheckedBorderColor: "#D7DBE3",
} satisfies SwitchColors;

function Switch({ value, onValueChange, disabled, testID }: SwitchProps) {
	return (
		<Host matchContents seedColor={DAYOVA_PRIMARY}>
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
