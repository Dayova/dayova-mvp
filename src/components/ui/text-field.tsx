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
	...inputProps
}: BaseTextFieldProps) {
	return (
		<Field className={className}>
			<FieldLabel>{label}</FieldLabel>
			<FieldControl
				invalid={invalid}
				className={cn(
					"min-h-[64px] items-center rounded-[28px] px-5 py-0",
					controlClassName,
				)}
			>
				<View className="flex-1">
					<Input
						accessibilityLabel={accessibilityLabel ?? label}
						className={cn("flex-none text-16", inputClassName)}
						{...inputProps}
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
