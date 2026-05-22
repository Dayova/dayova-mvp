import {
	TouchableOpacity,
	type TouchableOpacityProps,
	View,
	type ViewProps,
	type ViewStyle,
} from "react-native";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

const fieldSurfaceStyle: ViewStyle = DAYOVA_DESIGN_SYSTEM.elevation.surface;

const fieldInvalidStyle: ViewStyle = {
	borderColor: "rgba(239,68,68,0.72)",
};

function Field({ className, ...props }: ViewProps) {
	return <View className={cn("mb-6", className)} {...props} />;
}

function FieldLabel({
	className,
	style,
	...props
}: React.ComponentProps<typeof Text>) {
	return (
		<Text
			className={cn(
				"mb-3 font-poppins font-semibold text-16 text-text",
				className,
			)}
			style={[{ lineHeight: 22, includeFontPadding: false }, style]}
			{...props}
		/>
	);
}

function FieldControl({
	className,
	disabled,
	invalid,
	style,
	...props
}: ViewProps & {
	disabled?: boolean;
	invalid?: boolean;
}) {
	return (
		<View
			className={cn(
				"min-h-[64px] flex-row items-center rounded-[28px] bg-white px-5",
				disabled && "opacity-50",
				className,
			)}
			style={[fieldSurfaceStyle, invalid && fieldInvalidStyle, style]}
			{...props}
		/>
	);
}

function FieldTrigger({
	activeOpacity = 0.85,
	className,
	disabled,
	invalid,
	style,
	...props
}: TouchableOpacityProps & {
	invalid?: boolean;
}) {
	return (
		<TouchableOpacity
			activeOpacity={activeOpacity}
			className={cn(
				"min-h-[64px] flex-row items-center rounded-[28px] bg-white px-5",
				disabled && "opacity-50",
				className,
			)}
			style={[fieldSurfaceStyle, invalid && fieldInvalidStyle, style]}
			disabled={disabled}
			{...props}
		/>
	);
}

function FieldAccessory({ className, ...props }: ViewProps) {
	return <View className={cn("ml-4 shrink-0", className)} {...props} />;
}

function FieldMessage({
	className,
	...props
}: React.ComponentProps<typeof Text>) {
	return (
		<Text
			className={cn(
				"mt-2 ml-1 font-poppins text-12 text-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Field,
	FieldAccessory,
	FieldControl,
	FieldLabel,
	FieldMessage,
	FieldTrigger,
};
