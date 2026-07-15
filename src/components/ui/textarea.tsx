import type * as React from "react";
import { Platform, TextInput } from "react-native";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type TextareaRef = React.ElementRef<typeof TextInput>;
type TextareaProps = React.ComponentProps<typeof TextInput> & {
	ref?: React.Ref<TextareaRef>;
};

const androidTextareaStyle = Platform.select({
	android: {
		includeFontPadding: false,
	},
});

function Textarea({
	className,
	placeholderTextColor,
	selectionColor,
	style,
	ref,
	...props
}: TextareaProps) {
	const { colors } = useDayovaTheme();

	return (
		<TextInput
			ref={ref}
			multiline
			textAlignVertical="top"
			className={cn(
				"m-0 min-h-28 w-full flex-1 self-stretch px-0 py-1 font-poppins text-body-3 text-text tracking-normal",
				Platform.select({
					web: "outline-none",
				}),
				props.editable === false && "opacity-50",
				className,
			)}
			// Android TextInput keeps extra font padding unless we reset it through
			// the native style prop; the static typography/padding is class-based.
			style={[androidTextareaStyle, style]}
			underlineColorAndroid="transparent"
			placeholderTextColor={placeholderTextColor ?? `${colors.text}80`}
			selectionColor={selectionColor ?? colors.primary}
			{...props}
		/>
	);
}

export { Textarea };
