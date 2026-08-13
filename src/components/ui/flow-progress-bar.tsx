import { View, type ViewProps } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { cn } from "~/lib/utils";

export function FlowProgressBar({
	progress,
	className,
	style,
	...props
}: ViewProps & {
	progress: number;
}) {
	const clampedProgress = Math.min(Math.max(progress, 0), 1);

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
				layout={LinearTransition.duration(280)}
				className="h-full rounded-full bg-primary"
				// Progress width is runtime data, so it stays in the native style prop.
				style={{
					width: `${Math.max(7, clampedProgress * 100)}%`,
				}}
			/>
		</View>
	);
}
