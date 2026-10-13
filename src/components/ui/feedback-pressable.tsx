import { useEffect, useState } from "react";
import {
	AccessibilityInfo,
	Animated,
	Platform,
	Pressable,
	TouchableOpacity,
	useAnimatedValue,
} from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type FeedbackPressableProps = React.ComponentProps<typeof Pressable> & {
	pressFeedback?: boolean;
};

/** Shared by pressable actions and opacity-based controls. */
function usePressMotion(enabled: boolean) {
	const scale = useAnimatedValue(1);
	// Stay still until the system preference is known, including on first mount.
	const [reduceMotion, setReduceMotion] = useState(true);
	useEffect(() => {
		let active = true;
		let receivedChange = false;
		const subscription = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			(value) => {
				receivedChange = true;
				setReduceMotion(value);
			},
		);
		void AccessibilityInfo.isReduceMotionEnabled()
			.then((value) => {
				if (active && !receivedChange) setReduceMotion(value);
			})
			.catch(() => {});
		return () => {
			active = false;
			subscription.remove();
		};
	}, []);

	const animate = enabled && !reduceMotion;
	useEffect(() => {
		if (!animate) {
			scale.stopAnimation();
			scale.setValue(1);
		}
		return () => scale.stopAnimation();
	}, [animate, scale]);

	// Start at the touch event, so even a fast tap gets feedback before rerender.
	const pressIn = () => {
		if (!animate) return;
		Animated.timing(scale, {
			toValue: 0.97,
			duration: 90,
			useNativeDriver: Platform.OS !== "web",
		}).start();
	};
	const pressOut = () => {
		if (!animate) return;
		Animated.spring(scale, {
			toValue: 1,
			stiffness: 350,
			damping: 28,
			mass: 0.6,
			useNativeDriver: Platform.OS !== "web",
		}).start();
	};
	return { scale, pressIn, pressOut };
}

/** Adds press motion without changing existing actions, colors, or caller styles. */
export function FeedbackPressable({
	pressFeedback = true,
	disabled,
	onPressIn,
	onPressOut,
	style,
	...props
}: FeedbackPressableProps) {
	const [pressed, setPressed] = useState(false);
	const { scale, pressIn, pressOut } = usePressMotion(
		pressFeedback && !disabled,
	);

	return (
		<AnimatedPressable
			{...props}
			disabled={disabled}
			onPressIn={(event) => {
				if (!disabled) {
					setPressed(true);
					pressIn();
				}
				onPressIn?.(event);
			}}
			onPressOut={(event) => {
				setPressed(false);
				pressOut();
				onPressOut?.(event);
			}}
			// Caller transforms take precedence, preserving any existing motion.
			style={[
				{ transform: [{ scale }] },
				typeof style === "function"
					? style({ pressed: pressed && !disabled })
					: style,
			]}
		/>
	);
}

const AnimatedTouchableOpacity =
	Animated.createAnimatedComponent(TouchableOpacity);

/** Retains the existing opacity feedback, touch handling, and ref contract. */
export function FeedbackTouchableOpacity({
	disabled,
	onPressIn,
	onPressOut,
	style,
	...props
}: React.ComponentProps<typeof TouchableOpacity>) {
	const { scale, pressIn, pressOut } = usePressMotion(!disabled);
	return (
		<AnimatedTouchableOpacity
			{...props}
			disabled={disabled}
			onPressIn={(event) => {
				pressIn();
				onPressIn?.(event);
			}}
			onPressOut={(event) => {
				pressOut();
				onPressOut?.(event);
			}}
			// Runtime press transform; caller transforms still take precedence.
			style={[{ transform: [{ scale }] }, style]}
		/>
	);
}
