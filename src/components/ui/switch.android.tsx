import {
	Switch as ComposeSwitch,
	Host,
	type SwitchColors,
} from "@expo/ui/jetpack-compose";
import { testID as testIDModifier } from "@expo/ui/jetpack-compose/modifiers";
import { useMemo } from "react";
import type { SwitchProps } from "~/components/ui/switch.types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

const DAYOVA_PRIMARY = DAYOVA_DESIGN_SYSTEM.colors.primary;

function Switch({ value, onValueChange, disabled, testID }: SwitchProps) {
	const { colors } = useDayovaTheme();
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
