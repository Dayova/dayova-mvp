import type { ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

const OPTION_SHADOW = "0 4px 12px rgba(0, 0, 0, 0.06)";
const ICON_SHADOW =
	"0 2px 4px -2px rgba(24, 39, 75, 0.12), 0 4px 4px -2px rgba(24, 39, 75, 0.08)";

type ActionSheetOption<T extends string> = {
	value: T;
	title: string;
	description?: string;
	icon: ReactNode;
	disabled?: boolean;
};

type ActionSheetProps<T extends string> = {
	visible: boolean;
	title: ReactNode;
	description?: ReactNode;
	options: readonly ActionSheetOption<T>[];
	onSelect: (value: T) => void;
	onClose: () => void;
	onDismiss?: () => void;
	layout?: "row" | "tile";
	closeAccessibilityLabel?: string;
};

function ActionSheet<T extends string>({
	visible,
	title,
	description,
	options,
	onSelect,
	onClose,
	onDismiss,
	layout = "row",
	closeAccessibilityLabel = "Auswahl schließen",
}: ActionSheetProps<T>) {
	const isTile = layout === "tile";

	return (
		<DayovaSheetFrame
			visible={visible}
			title={title}
			description={description}
			onClose={onClose}
			onDismiss={onDismiss}
			closeAccessibilityLabel={closeAccessibilityLabel}
			contentClassName={isTile ? "flex-row gap-3" : "gap-3"}
		>
			{options.map((option) => (
				<TouchableOpacity
					key={option.value}
					accessibilityLabel={
						option.description
							? `${option.title}. ${option.description}`
							: option.title
					}
					accessibilityRole="button"
					accessibilityState={{ disabled: option.disabled }}
					activeOpacity={0.86}
					disabled={option.disabled}
					onPress={() => onSelect(option.value)}
					className={cn(
						"border border-border/45 bg-card",
						isTile
							? "min-h-36 flex-1 items-center justify-center gap-5 rounded-card px-4 py-5"
							: "min-h-20 w-full flex-row items-center gap-4 rounded-card px-4 py-3",
					)}
					style={{
						boxShadow: OPTION_SHADOW,
						opacity: option.disabled ? 0.55 : 1,
					}}
				>
					<View
						className={cn(
							"items-center justify-center rounded-full bg-system-subtle",
							isTile ? "h-16 w-16" : "h-14 w-14",
						)}
						style={{ boxShadow: ICON_SHADOW }}
					>
						{option.icon}
					</View>
					<View className={cn(isTile ? "items-center gap-1" : "flex-1 gap-1")}>
						<Text
							className={cn(
								"font-poppins text-text",
								isTile
									? "text-center font-semibold text-body-1"
									: "font-medium text-body-2",
							)}
							numberOfLines={2}
						>
							{option.title}
						</Text>
						{option.description ? (
							<Text
								className={cn(
									"font-poppins text-body-4 text-secondary-text",
									isTile && "text-center",
								)}
								numberOfLines={2}
							>
								{option.description}
							</Text>
						) : null}
					</View>
				</TouchableOpacity>
			))}
		</DayovaSheetFrame>
	);
}

const actionSheetIconColor = DAYOVA_DESIGN_SYSTEM.colors.primary;

export { ActionSheet, actionSheetIconColor };
