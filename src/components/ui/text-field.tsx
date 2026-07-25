import type * as React from "react";
import { View } from "react-native";
import {
	Field,
	FieldAccessory,
	FieldControl,
	FieldLabel,
	FieldMessage,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type InputProps = React.ComponentProps<typeof Input>;

type BaseTextFieldProps = Omit<InputProps, "className"> & {
	label: string;
	message?: string;
	invalid?: boolean;
	accessory?: React.ReactNode;
	className?: string;
	controlClassName?: string;
	inputClassName?: string;
	accessoryClassName?: string;
};

function InsetTextField({
	label,
	message,
	invalid,
	accessory,
	className,
	controlClassName,
	inputClassName,
	accessoryClassName,
	accessibilityLabel,
	accessibilityHint,
	...inputProps
}: BaseTextFieldProps) {
	return (
		<Field className={className}>
			<FieldLabel>{label}</FieldLabel>
			<FieldControl
				invalid={invalid}
				className={cn(
					"min-h-16 items-center rounded-input px-5 py-0",
					controlClassName,
				)}
			>
				<View className="min-w-0 flex-1 justify-center self-stretch">
					<Input
						{...inputProps}
						accessibilityLabel={accessibilityLabel ?? label}
						accessibilityHint={
							invalid && message
								? [accessibilityHint, `Fehler: ${message}`]
										.filter(Boolean)
										.join(". ")
								: accessibilityHint
						}
						className={cn("text-body-2", inputClassName)}
						multiline={false}
						numberOfLines={1}
					/>
				</View>
				{accessory ? (
					<FieldAccessory
						className={cn("ml-3 self-center", accessoryClassName)}
					>
						{accessory}
					</FieldAccessory>
				) : null}
			</FieldControl>
			{message ? <FieldMessage>{message}</FieldMessage> : null}
		</Field>
	);
}

export { InsetTextField };
