import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import type { ReactNode } from "react";
import {
	type LayoutChangeEvent,
	Pressable,
	type PressableProps,
	View,
	type ViewProps,
	type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

type NotchedActionCardProps = ViewProps & {
	actionAccessibilityLabel: string;
	actionIcon: ReactNode;
	actionOffsetBottom?: number;
	actionOffsetRight?: number;
	onActionPress: PressableProps["onPress"];
	actionSize?: number;
	cardHeight?: number;
	cardPath?: string;
	cardStyle?: ViewStyle;
};

const DEFAULT_CARD_WIDTH = 368;
const DEFAULT_CARD_HEIGHT = 211;
const COMPACT_CARD_HEIGHT = 144;
const CARD_CORNER_RADIUS = 44;
const CARD_STROKE_WIDTH = 1;
const ACTION_CLEARANCE = 4;
const DEFAULT_ACTION_SIZE = 48;
const DEFAULT_ACTION_OFFSET_RIGHT = 0;
const CUBIC_ARC = 0.5522847498;

const pathNumber = (value: number) => Number(value.toFixed(3)).toString();

const buildNotchedCardPath = ({
	actionOffsetBottom,
	actionOffsetRight,
	actionSize,
	height,
	width,
}: {
	actionOffsetBottom: number;
	actionOffsetRight: number;
	actionSize: number;
	height: number;
	width: number;
}) => {
	const inset = CARD_STROKE_WIDTH / 2;
	const left = inset;
	const top = inset;
	const right = width - inset;
	const bottom = height - inset;
	const cornerRadius = Math.min(
		CARD_CORNER_RADIUS,
		(right - left) / 2,
		(bottom - top) / 2,
	);
	const buttonRadius = actionSize / 2;
	const buttonCenterX = width - actionOffsetRight - buttonRadius;
	const buttonCenterY = height - actionOffsetBottom - buttonRadius;
	const notchRadius = buttonRadius + ACTION_CLEARANCE;
	const notchTopY = buttonCenterY - notchRadius;
	const notchLeftX = buttonCenterX - notchRadius;
	const rightJoinRadius = Math.max(
		0,
		Math.min(
			right - buttonCenterX,
			notchTopY - (top + cornerRadius),
			CARD_CORNER_RADIUS,
		),
	);
	const bottomJoinRadius = Math.max(
		0,
		Math.min(
			bottom - buttonCenterY,
			notchLeftX - (left + cornerRadius),
			CARD_CORNER_RADIUS,
		),
	);
	const rightJoinStartY = notchTopY - rightJoinRadius;
	const bottomJoinEndX = notchLeftX - bottomJoinRadius;

	const p = pathNumber;
	return [
		`M${p(left + cornerRadius)} ${p(top)}`,
		`H${p(right - cornerRadius)}`,
		`C${p(right - cornerRadius + cornerRadius * CUBIC_ARC)} ${p(top)} ${p(right)} ${p(top + cornerRadius - cornerRadius * CUBIC_ARC)} ${p(right)} ${p(top + cornerRadius)}`,
		`V${p(rightJoinStartY)}`,
		`C${p(right)} ${p(rightJoinStartY + rightJoinRadius * CUBIC_ARC)} ${p(buttonCenterX + rightJoinRadius * CUBIC_ARC)} ${p(notchTopY)} ${p(buttonCenterX)} ${p(notchTopY)}`,
		`C${p(buttonCenterX - notchRadius * CUBIC_ARC)} ${p(notchTopY)} ${p(notchLeftX)} ${p(buttonCenterY - notchRadius * CUBIC_ARC)} ${p(notchLeftX)} ${p(buttonCenterY)}`,
		`C${p(notchLeftX)} ${p(buttonCenterY + bottomJoinRadius * CUBIC_ARC)} ${p(bottomJoinEndX + bottomJoinRadius * CUBIC_ARC)} ${p(bottom)} ${p(bottomJoinEndX)} ${p(bottom)}`,
		`H${p(left + cornerRadius)}`,
		`C${p(left + cornerRadius - cornerRadius * CUBIC_ARC)} ${p(bottom)} ${p(left)} ${p(bottom - cornerRadius + cornerRadius * CUBIC_ARC)} ${p(left)} ${p(bottom - cornerRadius)}`,
		`V${p(top + cornerRadius)}`,
		`C${p(left)} ${p(top + cornerRadius - cornerRadius * CUBIC_ARC)} ${p(left + cornerRadius - cornerRadius * CUBIC_ARC)} ${p(top)} ${p(left + cornerRadius)} ${p(top)}`,
		"Z",
	].join(" ");
};

export function NotchedActionCard({
	actionAccessibilityLabel,
	actionIcon,
	actionOffsetBottom = 0,
	actionOffsetRight = DEFAULT_ACTION_OFFSET_RIGHT,
	actionSize = DEFAULT_ACTION_SIZE,
	cardHeight = DEFAULT_CARD_HEIGHT,
	cardPath,
	cardStyle,
	children,
	className,
	onActionPress,
	onLayout,
	style,
	...props
}: NotchedActionCardProps) {
	const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);
	const handleLayout = (event: LayoutChangeEvent) => {
		const nextWidth = event.nativeEvent.layout.width;
		setCardWidth((currentWidth) =>
			Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth,
		);
		onLayout?.(event);
	};
	const resolvedCardWidth = Math.max(cardWidth, actionSize + actionOffsetRight);
	const resolvedCardPath =
		cardPath ??
		buildNotchedCardPath({
			actionOffsetBottom,
			actionOffsetRight,
			actionSize,
			height: cardHeight,
			width: resolvedCardWidth,
		});

	return (
		<View
			className={cn("relative", className)}
			onLayout={handleLayout}
			style={[{ minHeight: cardHeight }, style]}
			{...props}
		>
			<Svg
				pointerEvents="none"
				width="100%"
				height={cardHeight}
				viewBox={`0 0 ${resolvedCardWidth} ${cardHeight}`}
				preserveAspectRatio="none"
				style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
			>
				<Path
					d={resolvedCardPath}
					fill={DAYOVA_DESIGN_SYSTEM.colors.surface}
					stroke={DAYOVA_DESIGN_SYSTEM.colors.border}
					strokeWidth={CARD_STROKE_WIDTH}
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
				className="absolute overflow-hidden rounded-full"
				onPress={onActionPress}
				style={{
					right: actionOffsetRight,
					bottom: actionOffsetBottom,
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

export function CompactNotchedActionCard({
	cardHeight = COMPACT_CARD_HEIGHT,
	...props
}: NotchedActionCardProps) {
	return <NotchedActionCard {...props} cardHeight={cardHeight} />;
}
