import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown } from "~/components/ui/icon";
import { SelectSheet } from "~/components/ui/select-sheet";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type PickerInputTriggerProps = {
	value: string;
	placeholder: string;
	accessibilityLabel: string;
	centered?: boolean;
	expanded?: boolean;
	testID?: string;
	onPress: () => void;
};

function PickerInputTrigger({
	value,
	placeholder,
	accessibilityLabel,
	centered = false,
	expanded,
	testID,
	onPress,
}: PickerInputTriggerProps) {
	const { colors } = useDayovaTheme();
	const hasValue = value.trim().length > 0;

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			accessibilityState={expanded === undefined ? undefined : { expanded }}
			className="min-h-[58px] w-full max-w-[312px] flex-row items-center justify-between gap-3 rounded-[29px] border border-text/5 bg-card px-5 shadow-black/5 shadow-lg"
			onPress={onPress}
			testID={testID}
		>
			<Text
				className={cn(
					"flex-1 font-poppins text-body-2",
					hasValue ? "text-text" : "text-text/40",
					centered && "px-7 text-center",
				)}
				numberOfLines={1}
			>
				{hasValue ? value : placeholder}
			</Text>
			<View
				className={centered ? "absolute right-5" : undefined}
				pointerEvents="none"
			>
				<ChevronDown size={20} color={colors.secondaryText} strokeWidth={2.1} />
			</View>
		</Pressable>
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
				centered
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
