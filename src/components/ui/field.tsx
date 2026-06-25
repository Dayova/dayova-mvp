import {
	TouchableOpacity,
	type TouchableOpacityProps,
	View,
	type ViewProps,
} from "react-native";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

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
			className={cn("mb-2 font-poppins text-body-4 text-text", className)}
			// Text style passthrough is kept for rare caller-supplied runtime text
			// values; static typography belongs in NativeWind classes.
			style={style}
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
				"min-h-16 flex-row items-center rounded-input border border-transparent bg-card px-5 shadow-black/5 shadow-sm",
				invalid && "border-destructive/70",
				disabled && "opacity-50",
				className,
			)}
			// Style passthrough is only for runtime-only values that NativeWind
			// cannot know at build time.
			style={style}
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
				"min-h-16 flex-row items-center rounded-input border border-transparent bg-card px-5 shadow-black/5 shadow-sm",
				invalid && "border-destructive/70",
				disabled && "opacity-50",
				className,
			)}
			// Style passthrough is only for runtime-only values that NativeWind
			// cannot know at build time.
			style={style}
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
				"mt-2 ml-1 font-poppins text-body-4 text-destructive",
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
