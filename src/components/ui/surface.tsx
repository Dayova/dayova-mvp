import {
	TouchableOpacity,
	type TouchableOpacityProps,
	View,
	type ViewProps,
	type ViewStyle,
} from "react-native";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type SurfaceVariant = "default" | "soft" | "flat";

const surfaceElevationByVariant: Record<SurfaceVariant, ViewStyle | undefined> =
	{
		default: DAYOVA_DESIGN_SYSTEM.elevation.surface,
		soft: DAYOVA_DESIGN_SYSTEM.elevation.soft,
		flat: undefined,
	};

function getSurfaceStyle(variant: SurfaceVariant, style?: ViewProps["style"]) {
	return [surfaceElevationByVariant[variant], style];
}

type SurfaceProps = ViewProps & {
	variant?: SurfaceVariant;
};

function Surface({
	className,
	style,
	variant = "default",
	...props
}: SurfaceProps) {
	return (
		<View
			className={cn("rounded-[32px] bg-white", className)}
			style={getSurfaceStyle(variant, style)}
			{...props}
		/>
	);
}

type ActionSurfaceProps = TouchableOpacityProps & {
	variant?: SurfaceVariant;
};

function ActionSurface({
	activeOpacity = 0.86,
	className,
	disabled,
	style,
	variant = "default",
	...props
}: ActionSurfaceProps) {
	return (
		<TouchableOpacity
			activeOpacity={activeOpacity}
			className={cn("rounded-[32px] bg-white", disabled && "opacity-55", className)}
			disabled={disabled}
			style={getSurfaceStyle(variant, style)}
			{...props}
		/>
	);
}

export { ActionSurface, Surface };
export type { SurfaceVariant };
