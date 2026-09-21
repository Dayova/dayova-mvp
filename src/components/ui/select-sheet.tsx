import type { ReactNode } from "react";
import { View } from "react-native";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import {
	SelectionControl,
	SelectionIndicator,
} from "~/components/ui/selection-control";
import { Text } from "~/components/ui/text";
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
					<SelectionControl
						key={option}
						accessibilityLabel={optionLabel}
						accessibilityRole="radio"
						selected={isSelected}
						onPress={() => {
							onSelect(option);
							onClose();
						}}
						contentClassName={cn(
							"min-h-16 gap-3 px-5 py-3",
							shouldStackInlineContent
								? "items-stretch gap-3 py-4"
								: "flex-row items-center",
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
								"text-text",
							)}
						>
							{optionLabel}
						</Text>
						<SelectionIndicator
							className={shouldStackInlineContent ? "self-end" : undefined}
						/>
					</SelectionControl>
				);
			})}
		</DayovaSheetFrame>
	);
}

export { SelectSheet };
