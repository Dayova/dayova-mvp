import type * as React from "react";
import { View } from "react-native";
import {
	Field,
	FieldAccessory,
	FieldControl,
	FieldMessage,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
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
			<FieldControl
				invalid={invalid}
				className={cn(
					"min-h-[74px] items-start rounded-[22px] px-5 pt-3 pb-3",
					controlClassName,
				)}
			>
				<View className="flex-1">
					<Text className="font-poppins text-12 text-text/42 leading-4">
						{label}
					</Text>
					<Input
						accessibilityLabel={accessibilityLabel ?? label}
						className={cn("mt-1 flex-none text-16", inputClassName)}
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
