import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { ClipboardEdit } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

// The card content ends 24 points from the edge. This keeps the footer another
// 44 points inward, leaving 20 points before the 48-point action and
// comfortable breathing room beside its notched border.
const FOOTER_ACTION_INSET = 44;

export function LearningPlanCardFooter({
	animateProgress = true,
	fixedTextScale = false,
	progress,
	remainingDays,
	rollingWindowLabel,
}: {
	animateProgress?: boolean;
	fixedTextScale?: boolean;
	progress: number;
	remainingDays: number;
	rollingWindowLabel: string;
}) {
	const { colors } = useDayovaTheme();
	const targetWidth = Math.max(progress, progress > 0 ? 8 : 0);
	const animatedWidth = useSharedValue(targetWidth);
	const reducedMotion = useReducedMotion();

	useEffect(() => {
		if (reducedMotion || !animateProgress) {
			animatedWidth.set(targetWidth);
			return;
		}
		if (animatedWidth.get() === targetWidth) return;
		animatedWidth.set(
			withTiming(targetWidth, {
				duration: 260,
				easing: Easing.out(Easing.cubic),
			}),
		);
		return () => cancelAnimation(animatedWidth);
	}, [animateProgress, animatedWidth, reducedMotion, targetWidth]);

	const progressStyle = useAnimatedStyle(() => ({
		width: `${animatedWidth.get()}%`,
	}));

	return (
		<View
			className="mt-4 w-full gap-1"
			style={{ paddingRight: FOOTER_ACTION_INSET }}
			testID="plan-card-footer"
		>
			<View className="flex-row items-end">
				<Text
					allowFontScaling={!fixedTextScale}
					className="font-poppins text-body-5 text-secondary-text"
					style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, paddingRight: 8 }}
				>
					{rollingWindowLabel}
				</Text>
				<View className="shrink-0 flex-row items-center gap-1">
					<ClipboardEdit
						size={14}
						color={colors.secondaryText}
						strokeWidth={2}
					/>
					<Text
						allowFontScaling={!fixedTextScale}
						className="font-poppins text-body-4 text-secondary-text"
						numberOfLines={1}
					>
						{remainingDays === 1 ? "noch 1 Tag" : `noch ${remainingDays} Tage`}
					</Text>
				</View>
			</View>
			<View
				accessibilityLabel={`${progress} Prozent abgeschlossen`}
				accessibilityValue={{
					max: 100,
					min: 0,
					now: progress,
					text: `${progress} Prozent`,
				}}
				accessibilityRole="progressbar"
				className="h-2 w-full overflow-hidden rounded-full bg-light-2"
			>
				<Animated.View
					className="h-full overflow-hidden rounded-full"
					// The existing fill width follows reactive progress on the UI thread.
					style={progressStyle}
					testID="plan-card-progress-fill"
				>
					<LinearGradient
						colors={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors}
						start={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start}
						end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
						style={{
							height: "100%",
							width: "100%",
							borderRadius: 999,
						}}
					/>
				</Animated.View>
			</View>
		</View>
	);
}
