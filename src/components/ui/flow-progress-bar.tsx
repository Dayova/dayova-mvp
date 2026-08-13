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
	initialProgress,
	className,
	style,
	...props
}: ViewProps & {
	progress: number;
	initialProgress?: number | null;
}) {
	const clampedProgress = Math.min(Math.max(progress, 0), 1);
	const targetProgress = Math.max(MINIMUM_VISIBLE_PROGRESS, clampedProgress);
	const clampedInitialProgress =
		initialProgress === null || initialProgress === undefined
			? targetProgress
			: Math.max(
					MINIMUM_VISIBLE_PROGRESS,
					Math.min(Math.max(initialProgress, 0), 1),
				);
	const animatedProgress = useSharedValue(clampedInitialProgress);
	const reducedMotion = useReducedMotion();
	const didMountRef = useRef(false);

	useEffect(() => {
		if (!didMountRef.current) {
			didMountRef.current = true;
			if (reducedMotion || clampedInitialProgress === targetProgress) {
				animatedProgress.set(targetProgress);
				return;
			}
			animatedProgress.set(
				withTiming(targetProgress, {
					duration: PROGRESS_TRANSITION_DURATION_MS,
					easing: Easing.out(Easing.cubic),
				}),
			);
			return;
		}
		if (reducedMotion) {
			animatedProgress.set(targetProgress);
			return;
		}

		animatedProgress.set(
			withTiming(targetProgress, {
				duration: PROGRESS_TRANSITION_DURATION_MS,
				easing: Easing.out(Easing.cubic),
			}),
		);
	}, [animatedProgress, clampedInitialProgress, reducedMotion, targetProgress]);

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
