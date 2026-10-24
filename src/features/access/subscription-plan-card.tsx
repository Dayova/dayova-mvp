import { View } from "react-native";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import {
	SelectionControl,
	SelectionIndicator,
} from "~/components/ui/selection-control";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function SubscriptionPlanCard({
	description,
	disabled = false,
	label,
	onPress,
	price,
	selected,
	testID,
}: {
	description: string;
	disabled?: boolean;
	label: string;
	onPress: () => void;
	price: string;
	selected: boolean;
	testID: string;
}) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	const { colors } = useDayovaTheme();
	return (
		<SelectionControl
			accessibilityLabel={`${label}, ${price}. ${description}`}
			disabled={disabled}
			selected={selected}
			onPress={onPress}
			testID={testID}
			contentClassName="gap-2 p-5"
		>
			<View className="flex-row items-start gap-3">
				<View
					className={cn(
						"flex-1 gap-2",
						!shouldStackInlineContent && "flex-row items-start justify-between",
					)}
				>
					<Text className="shrink font-semibold text-body-2 text-text">
						{label}
					</Text>
					<Text className="shrink font-semibold text-body-2 text-text">
						{price}
					</Text>
				</View>
				<SelectionIndicator
					checkColor={colors.onPrimary}
					testID={`${testID}-indicator`}
				/>
			</View>
			<Text className="text-body-4 text-secondary-text">{description}</Text>
		</SelectionControl>
	);
}
