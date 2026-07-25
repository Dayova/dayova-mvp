import { useState } from "react";
import { View } from "react-native";
import { FieldAccessory, FieldTrigger } from "~/components/ui/field";
import { ChevronDown } from "~/components/ui/icon";
import { SelectSheet } from "~/components/ui/select-sheet";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type PickerInputTriggerProps = {
	value: string;
	placeholder: string;
	accessibilityLabel: string;
	expanded?: boolean;
	testID?: string;
	onPress: () => void;
};

function PickerInputTrigger({
	value,
	placeholder,
	accessibilityLabel,
	expanded,
	testID,
	onPress,
}: PickerInputTriggerProps) {
	const { colors } = useDayovaTheme();
	const hasValue = value.trim().length > 0;

	return (
		<FieldTrigger
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			accessibilityState={expanded === undefined ? undefined : { expanded }}
			accessibilityValue={hasValue ? { text: value } : undefined}
			activeOpacity={0.86}
			className="w-full max-w-[345px]"
			onPress={onPress}
			testID={testID}
		>
			<Text
				className={cn(
					"flex-1 font-poppins text-body-2",
					hasValue ? "text-text" : "text-text/40",
				)}
				numberOfLines={1}
			>
				{hasValue ? value : placeholder}
			</Text>
			<FieldAccessory pointerEvents="none">
				<ChevronDown size={20} color={colors.secondaryText} strokeWidth={2.1} />
			</FieldAccessory>
		</FieldTrigger>
	);
}

type OnboardingSelectProps<T extends string> = {
	value: T;
	options: readonly T[];
	formatLabel?: (option: T) => string;
	accessibilityLabel: string;
	testID: string;
	title: string;
	onChange: (value: T) => void;
};

function OnboardingSelect<T extends string>({
	value,
	options,
	formatLabel,
	accessibilityLabel,
	testID,
	title,
	onChange,
}: OnboardingSelectProps<T>) {
	const [visible, setVisible] = useState(false);
	const selectedLabel = formatLabel ? formatLabel(value) : value;

	return (
		<View className="w-full items-center">
			<PickerInputTrigger
				accessibilityLabel={accessibilityLabel}
				expanded={visible}
				onPress={() => setVisible(true)}
				placeholder={accessibilityLabel}
				testID={testID}
				value={selectedLabel}
			/>
			<SelectSheet
				formatOptionLabel={formatLabel}
				onClose={() => setVisible(false)}
				onSelect={onChange}
				options={options}
				selectedValue={value}
				title={title}
				visible={visible}
			/>
		</View>
	);
}

export { OnboardingSelect, PickerInputTrigger };
