import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	type SharedValue,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import {
	ANIMATED_FLOWER_BASE_SIZE,
	type AnimatedFlowerPetal,
	getAnimatedFlowerGeometry,
	getAnimatedFlowerPetalPosition,
} from "~/components/ui/animated-flower-geometry";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const FLOWER_COLLAPSE_DURATION = 2400;
const FLOWER_EXPAND_DURATION = 2200;
const FLOWER_CYCLE_DURATION = 5000;
const FLOWER_REST_DURATION =
	FLOWER_CYCLE_DURATION - FLOWER_COLLAPSE_DURATION - FLOWER_EXPAND_DURATION;
const FLOWER_PETAL_OPACITY = 0.58;

function AnimatedFlowerPetalCircle({
	center,
	foldProgress,
	petal,
	petalSize,
}: {
	center: number;
	foldProgress: SharedValue<number>;
	petal: AnimatedFlowerPetal;
	petalSize: number;
}) {
	const petalStyle = useAnimatedStyle(() => {
		const position = getAnimatedFlowerPetalPosition(
			petal,
			foldProgress.get(),
			center,
		);
		return {
			transform: [
				{ translateX: position.cx - center },
				{ translateY: position.cy - center },
			],
		};
	});

	return (
		<Animated.View
			style={[
				{
					position: "absolute",
					left: center - petalSize / 2,
					top: center - petalSize / 2,
					height: petalSize,
					width: petalSize,
					borderRadius: petalSize / 2,
					backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.primary,
					opacity: FLOWER_PETAL_OPACITY,
				},
				petalStyle,
			]}
		/>
	);
}

export function AnimatedFlowerLoader({
	size = ANIMATED_FLOWER_BASE_SIZE,
}: {
	size?: number;
}) {
	const geometry = useMemo(() => getAnimatedFlowerGeometry(size), [size]);
	const foldProgress = useSharedValue(1);
	const flowerRotation = useSharedValue(0);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		if (reduceMotion) {
			flowerRotation.set(0);
			foldProgress.set(1);
			return;
		}

		flowerRotation.set(
			withRepeat(
				withSequence(
					withTiming(40, {
						duration: FLOWER_COLLAPSE_DURATION,
						easing: Easing.inOut(Easing.cubic),
					}),
					withDelay(
						FLOWER_EXPAND_DURATION + FLOWER_REST_DURATION,
						withTiming(0, { duration: 0 }),
					),
				),
				-1,
			),
		);
		foldProgress.set(
			withRepeat(
				withSequence(
					withTiming(0, {
						duration: FLOWER_COLLAPSE_DURATION,
						easing: Easing.inOut(Easing.cubic),
					}),
					withTiming(1, {
						duration: FLOWER_EXPAND_DURATION,
						easing: Easing.out(Easing.cubic),
					}),
					withDelay(FLOWER_REST_DURATION, withTiming(1, { duration: 0 })),
				),
				-1,
			),
		);

		return () => {
			cancelAnimation(flowerRotation);
			cancelAnimation(foldProgress);
		};
	}, [flowerRotation, foldProgress, reduceMotion]);

	const flowerStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${flowerRotation.get()}deg` }],
	}));

	return (
		<View style={{ height: geometry.size, width: geometry.size }}>
			<Animated.View className="h-full w-full" style={flowerStyle}>
				{geometry.petals.map((petal) => (
					<AnimatedFlowerPetalCircle
						key={petal.id}
						center={geometry.center}
						foldProgress={foldProgress}
						petal={petal}
						petalSize={geometry.petalSize}
					/>
				))}
			</Animated.View>
		</View>
	);
}
