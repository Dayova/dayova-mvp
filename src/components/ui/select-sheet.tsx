import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Check } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
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
	const { shouldStackInlineContent } = useContentSizeLayout();

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
							"min-h-16 rounded-[20px] border px-5",
							shouldStackInlineContent
								? "items-stretch gap-3 py-4"
								: "flex-row items-center",
							isSelected
								? "border-primary/35 bg-accent"
								: "border-text/10 bg-card",
						)}
					>
						{renderOptionIcon ? (
							<View
								className={cn(
									"h-9 w-9 items-center justify-center rounded-full bg-muted",
									!shouldStackInlineContent && "mr-5",
								)}
							>
								{renderOptionIcon(option, isSelected)}
							</View>
						) : null}
						<Text
							className={cn(
								"font-poppins text-body-2",
								shouldStackInlineContent ? "w-full" : "flex-1",
								isSelected ? "font-semibold text-primary" : "text-text",
							)}
						>
							{optionLabel}
						</Text>
						{isSelected ? (
							<View
								className={cn(
									"h-7 w-7 items-center justify-center rounded-full bg-primary",
									shouldStackInlineContent ? "self-end" : "ml-4",
								)}
							>
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
