import {
	TouchableOpacity,
	type TouchableOpacityProps,
	View,
	type ViewProps,
} from "react-native";
import { cn } from "~/lib/utils";

type SurfaceVariant = "default" | "soft" | "flat";

const surfaceClassByVariant: Record<SurfaceVariant, string> = {
	default: "shadow-black/5 shadow-sm",
	soft: "shadow-black/5 shadow",
	flat: "shadow-none",
};

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
			className={cn(
				"rounded-card bg-card",
				surfaceClassByVariant[variant],
				className,
			)}
			// Caller-provided styles are only for runtime values that cannot be
			// expressed as static NativeWind classes.
			style={style}
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
			className={cn(
				"rounded-card bg-card",
				surfaceClassByVariant[variant],
				disabled && "opacity-55",
				className,
			)}
			disabled={disabled}
			// Caller-provided styles are only for runtime values that cannot be
			// expressed as static NativeWind classes.
			style={style}
			{...props}
		/>
	);
}

export { ActionSurface, Surface };
