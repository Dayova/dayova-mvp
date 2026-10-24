import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { cn } from "~/lib/utils";

/** A decorative, one-shot outline over an existing completion illustration. */
export function CompletionAccent({
	color,
	shape = "card",
}: {
	color: string;
	shape?: "card" | "circle";
}) {
	// Reanimated's hook snapshots startup state; native preferences can change
	// while a learner is already using the app. Stay still until it is known.
	const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
	const progress = useSharedValue(0);

	useEffect(() => {
		let active = true;
		let receivedChange = false;
		const subscription = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			(enabled) => {
				receivedChange = true;
				setReduceMotion(enabled);
			},
		);
		void AccessibilityInfo.isReduceMotionEnabled()
			.then((enabled) => {
				if (active && !receivedChange) setReduceMotion(enabled);
			})
			.catch(() => {
				if (active && !receivedChange) setReduceMotion(true);
			});
		return () => {
			active = false;
			subscription.remove();
		};
	}, []);

	useEffect(() => {
		if (reduceMotion === null) return;
		if (reduceMotion) {
			progress.set(1);
			return;
		}
		if (progress.get() === 1) return;
		progress.set(
			withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
		);
		return () => cancelAnimation(progress);
	}, [progress, reduceMotion]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: interpolate(progress.get(), [0, 0.2, 1], [0, 0.4, 0]),
		transform: [{ scale: 0.96 + progress.get() * 0.16 }],
	}));

	if (reduceMotion !== false) return null;

	return (
		<Animated.View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			className={cn(
				"absolute inset-0 border-2",
				shape === "circle" ? "rounded-full" : "rounded-[32px]",
			)}
			// The outline follows the existing illustration's semantic accent.
			style={[{ borderColor: color }, animatedStyle]}
		/>
	);
}
