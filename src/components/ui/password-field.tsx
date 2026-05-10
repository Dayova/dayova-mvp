import type * as React from "react";
import { Platform, TextInput, TouchableOpacity, View } from "react-native";
import {
	Field,
	FieldAccessory,
	FieldControl,
	FieldMessage,
} from "~/components/ui/field";
import { Eye, EyeOff } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";

type PasswordFieldProps = Omit<
	React.ComponentProps<typeof TextInput>,
	"secureTextEntry" | "placeholderTextColor" | "selectionColor"
> & {
	label?: string;
	message?: string;
	submitMessage?: string;
	invalid?: boolean;
	visible: boolean;
	onToggleVisible: () => void;
};

function PasswordField({
	label = "Passwort",
	message,
	submitMessage,
	invalid,
	visible,
	onToggleVisible,
	style,
	accessibilityLabel,
	...inputProps
}: PasswordFieldProps) {
	return (
		<Field>
			<FieldControl
				invalid={invalid}
				className="min-h-[74px] items-start rounded-[22px] px-5 pt-3 pb-3"
			>
				<View className="flex-1">
					<Text className="font-poppins text-12 text-text/42 leading-4">
						{label}
					</Text>
					{/*
						Keep this as a native TextInput instead of Input. The shared Input's
						Poppins metrics can make hidden secure text invisible on device, while
						native secureTextEntry preserves editing, paste, accessibility, and
						password-manager behavior.
					*/}
					<TextInput
						accessibilityLabel={accessibilityLabel ?? label}
						placeholder="••••••••"
						secureTextEntry={!visible}
						autoCapitalize="none"
						autoCorrect={false}
						placeholderTextColor="rgba(26,26,26,0.36)"
						selectionColor="#3A7BFF"
						style={[
							{
								color: "#1A1A1A",
								fontSize: 16,
								height: 30,
								margin: 0,
								marginTop: 4,
								paddingHorizontal: 0,
								paddingVertical: 0,
								...Platform.select({
									android: {
										fontFamily: "sans-serif",
										includeFontPadding: true,
										textAlignVertical: "center" as const,
									},
								}),
							},
							style,
						]}
						{...inputProps}
					/>
				</View>
				<FieldAccessory className="ml-3 self-center">
					<TouchableOpacity
						activeOpacity={0.75}
						onPress={onToggleVisible}
						className="-my-3 -ml-6 h-11 w-11 items-end justify-center pr-0"
						hitSlop={{ top: 6, bottom: 6, left: 6, right: 0 }}
						accessibilityRole="button"
						accessibilityLabel={
							visible ? "Passwort verbergen" : "Passwort anzeigen"
						}
					>
						{visible ? (
							<Eye size={18} color="rgba(26,26,26,0.34)" />
						) : (
							<EyeOff size={18} color="rgba(26,26,26,0.34)" />
						)}
					</TouchableOpacity>
				</FieldAccessory>
			</FieldControl>
			{message ? <FieldMessage>{message}</FieldMessage> : null}
			{submitMessage ? <FieldMessage>{submitMessage}</FieldMessage> : null}
		</Field>
	);
}

export { PasswordField };
