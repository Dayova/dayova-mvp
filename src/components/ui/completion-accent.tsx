import { useEffect } from "react";
import Animated, {
	cancelAnimation,
	Easing,
	interpolate,
	useAnimatedStyle,
	useReducedMotion,
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
	const reduceMotion = useReducedMotion();
	const progress = useSharedValue(0);

	useEffect(() => {
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

	if (reduceMotion) return null;

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
