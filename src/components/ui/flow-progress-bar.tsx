import { useEffect, useRef } from "react";
import { View, type ViewProps } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { cn } from "~/lib/utils";

const MINIMUM_VISIBLE_PROGRESS = 0.07;
const PROGRESS_TRANSITION_DURATION_MS = 260;

export function FlowProgressBar({
	progress,
	className,
	style,
	...props
}: ViewProps & {
	progress: number;
}) {
	const clampedProgress = Math.min(Math.max(progress, 0), 1);
	const targetProgress = Math.max(MINIMUM_VISIBLE_PROGRESS, clampedProgress);
	const animatedProgress = useSharedValue(targetProgress);
	const reducedMotion = useReducedMotion();
	const didMountRef = useRef(false);

	useEffect(() => {
		if (!didMountRef.current || reducedMotion) {
			didMountRef.current = true;
			animatedProgress.set(targetProgress);
			return;
		}

		animatedProgress.set(
			withTiming(targetProgress, {
				duration: PROGRESS_TRANSITION_DURATION_MS,
				easing: Easing.out(Easing.cubic),
			}),
		);
	}, [animatedProgress, reducedMotion, targetProgress]);

	const progressStyle = useAnimatedStyle(() => ({
		width: `${animatedProgress.get() * 100}%`,
	}));

	return (
		<View
			className={cn(
				"h-2 overflow-hidden rounded-full bg-progress-track",
				className,
			)}
			style={style}
			{...props}
		>
			<Animated.View
				className="h-full rounded-full bg-primary"
				// Progress width is runtime animated state, so it stays in the native style prop.
				style={progressStyle}
			/>
		</View>
	);
}
