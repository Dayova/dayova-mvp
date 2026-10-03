import { useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const PLAN_ACTION_RAIL_WIDTH = 104;
const PLAN_SWIPE_OPEN_THRESHOLD = 44;

export function useLearningPlanSwipe(onOpen: () => void) {
	const [isActionRailVisible, setIsActionRailVisible] = useState(false);
	const translateX = useSharedValue(0);
	const gestureStartX = useSharedValue(0);
	const didSwipe = useSharedValue(false);
	const cardAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.get() }],
	}));
	const actionRailAnimatedStyle = useAnimatedStyle(() => ({
		opacity: interpolate(
			-translateX.get(),
			[0, 8, PLAN_ACTION_RAIL_WIDTH],
			[0, 0, 1],
			"clamp",
		),
	}));
	const panGesture = Gesture.Pan()
		.activeOffsetX([-10, 10])
		.failOffsetY([-12, 12])
		.onBegin(() => {
			"worklet";
			gestureStartX.set(translateX.get());
			didSwipe.set(false);
		})
		.onStart(() => {
			"worklet";
			// Keep this latched through release; JS onPress may arrive afterwards.
			didSwipe.set(true);
			scheduleOnRN(setIsActionRailVisible, true);
		})
		.onUpdate((event) => {
			"worklet";
			translateX.set(
				Math.max(
					Math.min(gestureStartX.get() + event.translationX, 0),
					-PLAN_ACTION_RAIL_WIDTH,
				),
			);
		})
		.onEnd(() => {
			"worklet";
			const shouldOpen = -translateX.get() >= PLAN_SWIPE_OPEN_THRESHOLD;
			translateX.set(
				shouldOpen
					? withTiming(-PLAN_ACTION_RAIL_WIDTH, {
							duration: 180,
							easing: Easing.out(Easing.cubic),
						})
					: withSpring(
							0,
							{
								damping: 20,
								mass: 0.7,
								overshootClamping: true,
								stiffness: 260,
							},
							(finished) => {
								"worklet";
								if (finished) scheduleOnRN(setIsActionRailVisible, false);
							},
						),
			);
		});
	const close = () => {
		translateX.set(0);
		setIsActionRailVisible(false);
	};
	const open = () => {
		if (didSwipe.get()) return;
		if (translateX.get() !== 0) {
			close();
			return;
		}
		onOpen();
	};
	return {
		isActionRailVisible,
		cardAnimatedStyle,
		actionRailAnimatedStyle,
		panGesture,
		close,
		open,
	};
}
