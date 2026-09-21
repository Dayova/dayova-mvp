import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, {
	Easing,
	interpolateColor,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

export type InboxCategory = "all" | "learningPlan" | "task";

const CATEGORIES: Array<{ key: InboxCategory; label: string }> = [
	{ key: "all", label: "Alle" },
	{ key: "learningPlan", label: "Lernpläne" },
	{ key: "task", label: "Aufgaben" },
];
const PRIMARY_INTERACTIVE_GRADIENT =
	DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;

export function CategoryTabs({
	value,
	onChange,
}: {
	value: InboxCategory;
	onChange: (category: InboxCategory) => void;
}) {
	const { colors } = useDayovaTheme();
	const selectedIndex = CATEGORIES.findIndex(
		(category) => category.key === value,
	);
	const indicatorWidth = useSharedValue(0);
	const selectionPosition = useSharedValue(selectedIndex);
	const indicatorStyle = useAnimatedStyle(() => ({
		width: indicatorWidth.get(),
		transform: [{ translateX: selectionPosition.get() * indicatorWidth.get() }],
	}));

	useEffect(() => {
		selectionPosition.set(
			withTiming(selectedIndex, {
				duration: 240,
				easing: Easing.out(Easing.cubic),
			}),
		);
	}, [selectedIndex, selectionPosition]);

	return (
		<View
			className="flex-row rounded-full bg-card"
			onLayout={({ nativeEvent }) => {
				const nextIndicatorWidth =
					(nativeEvent.layout.width - 8) / CATEGORIES.length;
				indicatorWidth.set(nextIndicatorWidth);
			}}
			style={{
				minHeight: 60,
				paddingHorizontal: 4,
				paddingVertical: 6,
				boxShadow: "0 6px 16px rgba(20, 28, 48, 0.06)",
			}}
		>
			<Animated.View
				pointerEvents="none"
				style={[
					{
						position: "absolute",
						left: 4,
						top: 6,
						height: 48,
						borderRadius: 999,
						overflow: "hidden",
					},
					indicatorStyle,
				]}
			>
				<LinearGradient
					colors={PRIMARY_INTERACTIVE_GRADIENT.colors}
					start={PRIMARY_INTERACTIVE_GRADIENT.start}
					end={PRIMARY_INTERACTIVE_GRADIENT.end}
					style={{ flex: 1 }}
				/>
			</Animated.View>
			{CATEGORIES.map((category, index) => {
				const selected = value === category.key;

				return (
					<TouchableOpacity
						key={category.key}
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						activeOpacity={0.84}
						onPress={() => onChange(category.key)}
						className="items-center justify-center rounded-full"
						style={{
							zIndex: 1,
							flexGrow: 1,
							flexBasis: 0,
							height: 48,
							minHeight: 48,
						}}
					>
						<CategoryTabLabel
							index={index}
							inactiveColor={colors.secondaryText}
							label={category.label}
							selectionPosition={selectionPosition}
						/>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

function CategoryTabLabel({
	index,
	inactiveColor,
	label,
	selectionPosition,
}: {
	index: number;
	inactiveColor: string;
	label: string;
	selectionPosition: SharedValue<number>;
}) {
	const animatedStyle = useAnimatedStyle(() => ({
		color: interpolateColor(
			Math.min(Math.abs(selectionPosition.get() - index), 1),
			[0, 1],
			["#FFFFFF", inactiveColor],
		),
	}));

	return (
		<Animated.Text
			className="font-poppins font-semibold text-body-4"
			// Reanimated owns the interpolated tab text color.
			style={animatedStyle}
		>
			{label}
		</Animated.Text>
	);
}
