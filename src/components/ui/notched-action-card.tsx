import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
	Pressable,
	View,
	type PressableProps,
	type ViewProps,
	type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type NotchedActionCardProps = ViewProps & {
	actionAccessibilityLabel: string;
	actionIcon: ReactNode;
	onActionPress: PressableProps["onPress"];
	actionSize?: number;
	cardStyle?: ViewStyle;
};

export function NotchedActionCard({
	actionAccessibilityLabel,
	actionIcon,
	actionSize = 56,
	cardStyle,
	children,
	className,
	onActionPress,
	style,
	...props
}: NotchedActionCardProps) {
	const cardWidth = 368;
	const cardHeight = 211;
	const cardPath =
		"M40 1 H329 C351 1 368 18 368 40 V100 C368 129 348 150 318 150 C300 150 292 166 292 184 C292 199 284 207 272 211 H40 C18 211 1 194 1 172 V40 C1 18 18 1 40 1 Z";

	return (
		<View
			className={cn("relative", className)}
			style={[{ minHeight: cardHeight }, style]}
			{...props}
		>
			<Svg
				pointerEvents="none"
				width="100%"
				height={cardHeight}
				viewBox={`0 0 ${cardWidth} ${cardHeight}`}
				preserveAspectRatio="none"
				style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
			>
				<Path
					d={cardPath}
					fill={DAYOVA_DESIGN_SYSTEM.colors.surface}
					stroke={DAYOVA_DESIGN_SYSTEM.colors.border}
					strokeWidth={1}
				/>
			</Svg>

			<View
				className="px-6 pt-6"
				style={[
					{
						minHeight: cardHeight,
						paddingRight: actionSize + 24,
						paddingBottom: 22,
					},
					cardStyle,
				]}
			>
				{children}
			</View>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel={actionAccessibilityLabel}
				className="absolute bottom-0 overflow-hidden rounded-full"
				onPress={onActionPress}
				style={{
					right: 8,
					width: actionSize,
					height: actionSize,
				}}
			>
				<LinearGradient
					colors={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors}
					start={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start}
					end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
					style={{
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{actionIcon}
				</LinearGradient>
			</Pressable>
		</View>
	);
}
