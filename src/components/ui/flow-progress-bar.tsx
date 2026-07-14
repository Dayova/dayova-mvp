import { View, type ViewProps } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function FlowProgressBar({
	progress,
	className,
	style,
	...props
}: ViewProps & {
	progress: number;
}) {
	const { colors } = useDayovaTheme();
	const clampedProgress = Math.min(Math.max(progress, 0), 1);

	return (
		<View
			className={cn("h-2 overflow-hidden rounded-full", className)}
			style={[{ backgroundColor: "#CFEAFF" }, style]}
			{...props}
		>
			<Animated.View
				layout={LinearTransition.duration(280)}
				className="h-full rounded-full"
				style={{
					width: `${Math.max(7, clampedProgress * 100)}%`,
					backgroundColor: colors.primary,
				}}
			/>
		</View>
	);
}
