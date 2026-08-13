import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type SelectSheetProps<T extends string | number> = {
	visible: boolean;
	title: string;
	options: readonly T[];
	selectedValue: T | "";
	onSelect: (value: T) => void;
	onClose: () => void;
	formatOptionLabel?: (option: T) => string;
	renderOptionIcon?: (option: T, isSelected: boolean) => ReactNode;
};

function SelectSheet<T extends string | number>({
	visible,
	title,
	options,
	selectedValue,
	onSelect,
	onClose,
	formatOptionLabel,
	renderOptionIcon,
}: SelectSheetProps<T>) {
	return (
		<DayovaSheetFrame
			visible={visible}
			title={title}
			onClose={onClose}
			closeAccessibilityLabel="Auswahl schließen"
			contentClassName="gap-3"
			scrollable
			size="medium"
		>
			{options.map((option) => {
				const isSelected = selectedValue === option;
				const optionLabel = formatOptionLabel
					? formatOptionLabel(option)
					: String(option);

				return (
					<Pressable
						key={option}
						accessibilityLabel={optionLabel}
						accessibilityRole="radio"
						accessibilityState={{ checked: isSelected }}
						onPress={() => {
							onSelect(option);
							onClose();
						}}
						className={cn(
							"min-h-16 flex-row items-center rounded-[20px] border px-5",
							isSelected
								? "border-primary/35 bg-accent"
								: "border-text/10 bg-card",
						)}
					>
						{renderOptionIcon ? (
							<View className="mr-5 h-9 w-9 items-center justify-center rounded-full bg-muted">
								{renderOptionIcon(option, isSelected)}
							</View>
						) : null}
						<Text
							className={cn(
								"flex-1 font-poppins text-body-2",
								isSelected ? "font-semibold text-primary" : "text-text",
							)}
						>
							{optionLabel}
						</Text>
						{isSelected ? (
							<View className="ml-4 h-7 w-7 items-center justify-center rounded-full bg-primary">
								<Check
									size={16}
									color={DAYOVA_DESIGN_SYSTEM.colors.light1}
									strokeWidth={2.4}
								/>
							</View>
						) : null}
					</Pressable>
				);
			})}
		</DayovaSheetFrame>
	);
}

export { SelectSheet };
