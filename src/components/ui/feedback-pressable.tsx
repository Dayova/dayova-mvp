import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Animated,
	type LayoutChangeEvent,
	Platform,
	Pressable,
	TouchableOpacity,
	useAnimatedValue,
} from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type FeedbackPressableProps = React.ComponentProps<typeof Pressable> & {
	pressFeedback?: boolean;
	pressScale?: number;
};

// Compact actions need more compression to make the same feedback perceptible.
export function getPressScaleForSize(width: number, height: number) {
	return width > 0 && width <= 96 && height > 0 && height <= 64 ? 0.92 : 0.97;
}

function useMeasuredPressScale(
	explicitScale: number | undefined,
	onLayout: ((event: LayoutChangeEvent) => void) | undefined,
) {
	const [measuredScale, setMeasuredScale] = useState(0.97);
	return {
		pressScale: explicitScale ?? measuredScale,
		onLayout: (event: LayoutChangeEvent) => {
			const { width, height } = event.nativeEvent.layout;
			setMeasuredScale(getPressScaleForSize(width, height));
			onLayout?.(event);
		},
	};
}

/** Shared by pressable actions and opacity-based controls. */
export function usePressMotion(enabled: boolean, pressScale = 0.97) {
	const scale = useAnimatedValue(1);
	const motion = useRef({ generation: 0, compressing: false, released: false });
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
		const state = motion.current;
		if (!animate) {
			state.generation += 1;
			state.compressing = false;
			scale.stopAnimation();
			scale.setValue(1);
		}
		return () => {
			state.generation += 1;
			state.compressing = false;
			scale.stopAnimation();
		};
	}, [animate, scale]);

	const release = () => {
		Animated.spring(scale, {
			toValue: 1,
			stiffness: 350,
			damping: 28,
			mass: 0.6,
			useNativeDriver: Platform.OS !== "web",
		}).start();
	};
	const pressIn = () => {
		if (!animate) return;
		const generation = ++motion.current.generation;
		motion.current.compressing = true;
		motion.current.released = false;
		Animated.timing(scale, {
			toValue: pressScale,
			duration: 90,
			useNativeDriver: Platform.OS !== "web",
		}).start(({ finished }) => {
			if (motion.current.generation !== generation) return;
			motion.current.compressing = false;
			if (finished && motion.current.released) release();
		});
	};
	const pressOut = () => {
		if (!animate) return;
		motion.current.released = true;
		// Finish the short compression even on quick taps. Action dispatch is
		// independent, so opening or closing a screen never waits for motion.
		if (!motion.current.compressing) release();
	};
	return { scale, pressIn, pressOut };
}

/** Adds press motion without changing existing actions, colors, or caller styles. */
export function FeedbackPressable({
	pressFeedback = true,
	pressScale,
	onLayout,
	disabled,
	onPressIn,
	onPressOut,
	style,
	...props
}: FeedbackPressableProps) {
	const [pressed, setPressed] = useState(false);
	const measured = useMeasuredPressScale(pressScale, onLayout);
	const { scale, pressIn, pressOut } = usePressMotion(
		pressFeedback && !disabled,
		measured.pressScale,
	);

	return (
		<AnimatedPressable
			{...props}
			disabled={disabled}
			onLayout={measured.onLayout}
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
type FeedbackTouchableOpacityProps = React.ComponentProps<
	typeof TouchableOpacity
> & {
	pressScale?: number;
};

export function FeedbackTouchableOpacity({
	pressScale,
	onLayout,
	disabled,
	onPressIn,
	onPressOut,
	style,
	...props
}: FeedbackTouchableOpacityProps) {
	const measured = useMeasuredPressScale(pressScale, onLayout);
	const { scale, pressIn, pressOut } = usePressMotion(
		!disabled,
		measured.pressScale,
	);
	return (
		<AnimatedTouchableOpacity
			{...props}
			disabled={disabled}
			onLayout={measured.onLayout}
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
