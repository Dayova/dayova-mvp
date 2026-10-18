import { useEffect } from "react";
import {
	Easing,
	useReducedMotion,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";

const SETTLE = { duration: 240, dampingRatio: 0.8 };

/** Presentation only: callers commit controlled selection from onPress. */
export function useSelectionMotion(selected: boolean, disabled = false) {
	const reduceMotion = useReducedMotion();
	const progress = useSharedValue(Number(selected));
	const checkScale = useSharedValue(selected ? 1 : 0.6);
	const pressScale = useSharedValue(1);

	useEffect(() => {
		progress.set(
			reduceMotion
				? Number(selected)
				: withTiming(Number(selected), {
						duration: 180,
						easing: Easing.out(Easing.cubic),
					}),
		);
		checkScale.set(reduceMotion ? 1 : withSpring(selected ? 1 : 0.6, SETTLE));
	}, [checkScale, progress, reduceMotion, selected]);

	useEffect(() => {
		if (disabled || reduceMotion) pressScale.set(1);
	}, [disabled, pressScale, reduceMotion]);

	return {
		progress,
		checkScale,
		pressScale,
		onPressIn: () => {
			if (!disabled && !reduceMotion)
				pressScale.set(withTiming(0.98, { duration: 90 }));
		},
		onPressOut: () => {
			pressScale.set(reduceMotion ? 1 : withSpring(1, SETTLE));
		},
	};
}
