import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { FeedbackTouchableOpacity } from "~/components/ui/feedback-pressable";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
export type PlanTab = "learningPlans" | "homework";
const PLANS_TAB_SWITCH_HEIGHT = 58;
const PLANS_TAB_SWITCH_PADDING = 6;
const PLANS_TAB_SWITCH_GAP = 12;
const PLANS_TAB_INDICATOR_HEIGHT = 44;
export function PlansTabSwitch({
	activeTab,
	onChange,
}: {
	activeTab: PlanTab;
	onChange: (tab: PlanTab) => void;
}) {
	const tabs: Array<{ key: PlanTab; label: string }> = [
		{ key: "learningPlans", label: "Lernpläne" },
		{ key: "homework", label: "Hausaufgaben" },
	];
	const [switchWidth, setSwitchWidth] = useState(0);
	const activeTabIndex = activeTab === "learningPlans" ? 0 : 1;
	const indicatorPosition = useSharedValue(activeTabIndex);
	const indicatorWidth =
		switchWidth > 0
			? (switchWidth - PLANS_TAB_SWITCH_PADDING * 2 - PLANS_TAB_SWITCH_GAP) / 2
			: 0;

	useEffect(() => {
		indicatorPosition.set(
			withSpring(activeTabIndex, {
				damping: 17,
				mass: 0.72,
				stiffness: 210,
			}),
		);
	}, [activeTabIndex, indicatorPosition]);

	const indicatorStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateX:
					indicatorPosition.get() * (indicatorWidth + PLANS_TAB_SWITCH_GAP),
			},
		],
	}));

	return (
		<View
			accessibilityRole="tablist"
			className="flex-row items-center border border-border bg-card"
			onLayout={({ nativeEvent }) => {
				setSwitchWidth(nativeEvent.layout.width);
			}}
			style={{
				height: PLANS_TAB_SWITCH_HEIGHT,
				borderRadius: 44,
				padding: PLANS_TAB_SWITCH_PADDING,
				columnGap: PLANS_TAB_SWITCH_GAP,
			}}
		>
			{indicatorWidth > 0 ? (
				<Animated.View
					pointerEvents="none"
					style={[
						{
							position: "absolute",
							left: PLANS_TAB_SWITCH_PADDING,
							top: PLANS_TAB_SWITCH_PADDING,
							width: indicatorWidth,
							height: PLANS_TAB_INDICATOR_HEIGHT,
							borderRadius: 44,
							overflow: "hidden",
						},
						indicatorStyle,
					]}
				>
					<LinearGradient
						colors={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors}
						start={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start}
						end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
						style={{ flex: 1 }}
					/>
				</Animated.View>
			) : null}
			{tabs.map((tab) => {
				const isActive = tab.key === activeTab;
				return (
					<FeedbackTouchableOpacity
						key={tab.key}
						accessibilityRole="tab"
						accessibilityState={{ selected: isActive }}
						activeOpacity={0.9}
						onPress={() => onChange(tab.key)}
						style={{
							flex: 1,
							minWidth: 0,
							height: PLANS_TAB_INDICATOR_HEIGHT,
							borderRadius: 44,
						}}
					>
						<View className="h-full w-full items-center justify-center rounded-[44px]">
							<Text
								className={
									isActive
										? "font-poppins font-semibold text-body-2"
										: "font-poppins font-semibold text-body-2 text-text"
								}
								numberOfLines={1}
								style={
									isActive
										? { color: DAYOVA_DESIGN_SYSTEM.colors.light1 }
										: undefined
								}
							>
								{tab.label}
							</Text>
						</View>
					</FeedbackTouchableOpacity>
				);
			})}
		</View>
	);
}
