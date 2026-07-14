import type * as React from "react";
import { Platform, TextInput } from "react-native";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type InputRef = React.ElementRef<typeof TextInput>;
type InputProps = React.ComponentProps<typeof TextInput> & {
	ref?: React.Ref<InputRef>;
};

const androidTextInputStyle = Platform.select({
	android: {
		includeFontPadding: false,
		textAlignVertical: "center" as const,
	},
});

function Input({
	className,
	placeholderTextColor,
	selectionColor,
	style,
	ref,
	...props
}: InputProps) {
	const { colors } = useDayovaTheme();

	return (
		<TextInput
			ref={ref}
			className={cn(
				"m-0 flex-1 px-0 py-0 font-poppins text-body-2 text-text tracking-normal",
				Platform.select({
					web: "outline-none",
				}),
				props.editable === false && "opacity-50",
				className,
			)}
			// Android TextInput has native font padding/vertical alignment behavior
			// that NativeWind cannot fully reset with classes.
			style={[androidTextInputStyle, style]}
			placeholderTextColor={placeholderTextColor ?? `${colors.text}80`}
			selectionColor={selectionColor ?? colors.primary}
			{...props}
		/>
	);
}

export { Input };
