import { Pressable, View } from "react-native";
import Animated, {
	interpolateColor,
	useAnimatedStyle,
} from "react-native-reanimated";
import { Check } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { useSelectionMotion } from "~/components/ui/selection-motion";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

const BRAND_COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const WHITE = BRAND_COLORS.light1;
// Access setup keeps its documented fixed-light glass treatment in both themes.
const primaryTextStyle = { color: BRAND_COLORS.text };
const secondaryTextStyle = { color: BRAND_COLORS.secondaryText };
const planGlassSurface = "rgba(255, 255, 255, 0.8)";
const planGlassBorder = "rgba(255, 255, 255, 0.6)";

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
	const { progress, checkScale, pressScale, onPressIn, onPressOut } =
		useSelectionMotion(selected, disabled);
	const { shouldStackInlineContent } = useContentSizeLayout();
	const cardStyle = useAnimatedStyle(() => ({
		transform: [{ scale: pressScale.get() }],
		backgroundColor: planGlassSurface,
		borderColor: interpolateColor(
			progress.get(),
			[0, 1],
			[planGlassBorder, BRAND_COLORS.text],
		),
		borderWidth: 1,
		boxShadow: selected
			? "inset 0 1px 0 rgba(255, 255, 255, 0.64), 0 8px 20px rgba(9, 54, 78, 0.1)"
			: "inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 6px 16px rgba(9, 54, 78, 0.08)",
	}));
	const indicatorStyle = useAnimatedStyle(() => ({
		backgroundColor: interpolateColor(
			progress.get(),
			[0, 1],
			[BRAND_COLORS.surface, BRAND_COLORS.text],
		),
		borderColor: interpolateColor(
			progress.get(),
			[0, 1],
			[BRAND_COLORS.border, BRAND_COLORS.text],
		),
	}));
	const checkStyle = useAnimatedStyle(() => ({
		opacity: progress.get(),
		transform: [{ scale: checkScale.get() }],
	}));
	return (
		<Pressable
			accessibilityLabel={`${label}, ${price}. ${description}`}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected, disabled }}
			disabled={disabled}
			onPress={onPress}
			onPressIn={onPressIn}
			onPressOut={onPressOut}
			testID={testID}
		>
			{/* The native hit area stays fixed while its presentation scales. */}
			<Animated.View className="rounded-3xl border px-5 py-4" style={cardStyle}>
				<View
					className={cn(
						"gap-3",
						!shouldStackInlineContent && "flex-row items-start",
					)}
				>
					<View className={cn(!shouldStackInlineContent && "flex-1")}>
						<Text
							className="font-semibold text-body-2"
							style={primaryTextStyle}
						>
							{label}
						</Text>
						<Text className="mt-1 text-body-4" style={secondaryTextStyle}>
							{description}
						</Text>
					</View>
					<View
						className={cn(
							"gap-2",
							shouldStackInlineContent
								? "flex-row items-center justify-between"
								: "items-end",
						)}
					>
						<Text
							className="font-semibold text-body-2"
							style={primaryTextStyle}
						>
							{price}
						</Text>
						<Animated.View
							accessible={false}
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							className="h-6 w-6 items-center justify-center rounded-full border"
							style={indicatorStyle}
							testID={`${testID}-indicator`}
						>
							<Animated.View style={checkStyle}>
								<Check size={14} color={WHITE} strokeWidth={3} />
							</Animated.View>
						</Animated.View>
					</View>
				</View>
			</Animated.View>
		</Pressable>
	);
}
