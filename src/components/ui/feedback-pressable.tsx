import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Animated,
	Platform,
	Pressable,
	useAnimatedValue,
} from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type FeedbackPressableProps = React.ComponentProps<typeof Pressable> & {
	pressFeedback?: boolean;
};

/** Adds press motion without changing existing actions, colors, or caller styles. */
export function FeedbackPressable({
	pressFeedback = true,
	disabled,
	onPressIn,
	onPressOut,
	style,
	...props
}: FeedbackPressableProps) {
	const scale = useAnimatedValue(1);
	const wasPressed = useRef(false);
	const [pressed, setPressed] = useState(false);
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

	const animate = pressFeedback && !disabled && !reduceMotion;
	useEffect(() => {
		if (!animate) {
			wasPressed.current = false;
			scale.stopAnimation();
			scale.setValue(1);
			return;
		}
		if (!pressed && !wasPressed.current) return;
		wasPressed.current = pressed;
		const animation = pressed
			? Animated.timing(scale, {
					toValue: 0.98,
					duration: 90,
					useNativeDriver: Platform.OS !== "web",
				})
			: Animated.spring(scale, {
					toValue: 1,
					stiffness: 350,
					damping: 28,
					mass: 0.6,
					useNativeDriver: Platform.OS !== "web",
				});
		animation.start();
		return () => animation.stop();
	}, [animate, pressed, scale]);

	return (
		<AnimatedPressable
			{...props}
			disabled={disabled}
			onPressIn={(event) => {
				if (!disabled) setPressed(true);
				onPressIn?.(event);
			}}
			onPressOut={(event) => {
				setPressed(false);
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
