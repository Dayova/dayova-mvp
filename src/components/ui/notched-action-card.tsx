import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
	type AccessibilityRole,
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

type CommonProps = Omit<
	ViewProps,
	| "accessible"
	| "accessibilityLabel"
	| "accessibilityHint"
	| "accessibilityRole"
	| "accessibilityState"
> & {
	actionIcon: ReactNode;
	actionOffsetBottom?: number;
	actionOffsetRight?: number;
	actionSize?: number;
	cardHeight?: number;
	cardPath?: string;
	cardStyle?: ViewStyle;
	children?: ReactNode;
};

type ActionPressProps = {
	pressType: "action";
	onPress: NonNullable<PressableProps["onPress"]>;

	actionAccessibilityLabel: string;
	actionAccessibilityHint?: string;
	actionDisabled?: boolean;

	/**
	 * Accessibility information for the non-interactive card content.
	 * Usually unnecessary when the card contains accessible Text children.
	 */
	cardAccessibilityLabel?: never;
	cardAccessibilityHint?: never;
	cardAccessibilityRole?: never;
	cardDisabled?: never;
};

type CardPressProps = {
	pressType: "card";
	onPress: NonNullable<PressableProps["onPress"]>;

	cardAccessibilityLabel: string;
	cardAccessibilityHint?: string;
	cardAccessibilityRole?: AccessibilityRole;
	cardDisabled?: boolean;

	/**
	 * The circular action visual is decorative in card mode, so it must not
	 * expose a separate accessibility label.
	 */
	actionAccessibilityLabel?: never;
	actionAccessibilityHint?: never;
	actionDisabled?: never;
};

export type NotchedActionCardProps = CommonProps &
	(ActionPressProps | CardPressProps);

const DEFAULT_CARD_WIDTH = 368;
const DEFAULT_CARD_HEIGHT = 211;
const COMPACT_CARD_HEIGHT = 144;
const CARD_CORNER_RADIUS = 44;
const CARD_STROKE_WIDTH = 1;
const ACTION_CLEARANCE = 4;
const DEFAULT_ACTION_SIZE = 48;
const DEFAULT_ACTION_OFFSET_RIGHT = 0;
const MINIMUM_TOUCH_TARGET_SIZE = 44;
const CUBIC_ARC = 0.5522847498;

const pathNumber = (value: number) => Number(value.toFixed(3)).toString();

function buildNotchedCardPath({
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
}) {
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
}

function DecorativeAction({
	actionIcon,
	actionOffsetBottom,
	actionOffsetRight,
	actionSize,
}: {
	actionIcon: ReactNode;
	actionOffsetBottom: number;
	actionOffsetRight: number;
	actionSize: number;
}) {
	return (
		<ActionFrame
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			actionOffsetBottom={actionOffsetBottom}
			actionOffsetRight={actionOffsetRight}
			actionSize={actionSize}
		>
			<ActionGradient>{actionIcon}</ActionGradient>
		</ActionFrame>
	);
}

function ActionFrame({
	actionOffsetBottom,
	actionOffsetRight,
	actionSize,
	children,
	...props
}: ViewProps & {
	actionOffsetBottom: number;
	actionOffsetRight: number;
	actionSize: number;
}) {
	return (
		<View
			{...props}
			className={cn("absolute z-20 overflow-hidden", props.className)}
			style={[
				{
					position: "absolute",
					right: actionOffsetRight,
					bottom: actionOffsetBottom,
					width: actionSize,
					height: actionSize,
					borderRadius: actionSize / 2,
					zIndex: 20,
					elevation: 20,
					overflow: "hidden",
				},
				props.style,
			]}
		>
			{children}
		</View>
	);
}

function ActionPressableFrame({
	actionAccessibilityHint,
	actionAccessibilityLabel,
	actionDisabled,
	actionIcon,
	actionOffsetBottom,
	actionOffsetRight,
	actionSize,
	onPress,
}: {
	actionAccessibilityHint?: string;
	actionAccessibilityLabel: string;
	actionDisabled: boolean;
	actionIcon: ReactNode;
	actionOffsetBottom: number;
	actionOffsetRight: number;
	actionSize: number;
	onPress: NonNullable<PressableProps["onPress"]>;
}) {
	const [pressed, setPressed] = useState(false);
	const touchTargetExpansion = Math.max(
		0,
		(MINIMUM_TOUCH_TARGET_SIZE - actionSize) / 2,
	);

	return (
		<>
			<ActionFrame
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				pointerEvents="none"
				actionOffsetBottom={actionOffsetBottom}
				actionOffsetRight={actionOffsetRight}
				actionSize={actionSize}
				style={pressed && !actionDisabled ? { opacity: 0.72 } : null}
			>
				<ActionGradient>{actionIcon}</ActionGradient>
			</ActionFrame>

			<Pressable
				accessible
				accessibilityRole="button"
				accessibilityLabel={actionAccessibilityLabel}
				accessibilityHint={actionAccessibilityHint}
				accessibilityState={{ disabled: actionDisabled }}
				disabled={actionDisabled}
				hitSlop={touchTargetExpansion}
				onPress={onPress}
				onPressIn={() => setPressed(true)}
				onPressOut={() => setPressed(false)}
				style={{
					position: "absolute",
					right: actionOffsetRight,
					bottom: actionOffsetBottom,
					width: actionSize,
					height: actionSize,
					borderRadius: actionSize / 2,
					zIndex: 30,
					elevation: 30,
					backgroundColor: "transparent",
				}}
			/>
		</>
	);
}

function ActionGradient({ children }: { children: ReactNode }) {
	return (
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
			{children}
		</LinearGradient>
	);
}

export function NotchedActionCard({
	actionIcon,
	actionOffsetBottom = 0,
	actionOffsetRight = DEFAULT_ACTION_OFFSET_RIGHT,
	actionSize = DEFAULT_ACTION_SIZE,
	cardHeight = DEFAULT_CARD_HEIGHT,
	cardPath,
	cardStyle,
	children,
	className,
	onLayout,
	style,
	...props
}: NotchedActionCardProps) {
	const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);

	const handleLayout = useCallback(
		(event: LayoutChangeEvent) => {
			const nextWidth = event.nativeEvent.layout.width;

			setCardWidth((currentWidth) =>
				Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth,
			);

			onLayout?.(event);
		},
		[onLayout],
	);

	const resolvedCardWidth = Math.max(cardWidth, actionSize + actionOffsetRight);

	const resolvedCardPath = useMemo(
		() =>
			cardPath ??
			buildNotchedCardPath({
				actionOffsetBottom,
				actionOffsetRight,
				actionSize,
				height: cardHeight,
				width: resolvedCardWidth,
			}),
		[
			actionOffsetBottom,
			actionOffsetRight,
			actionSize,
			cardHeight,
			cardPath,
			resolvedCardWidth,
		],
	);

	const cardContents = (
		<>
			<Svg
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
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
				className="relative z-10 w-full px-6 pt-6 pb-[22px]"
				style={[
					cardStyle,
					{
						minHeight: cardHeight,
					},
				]}
			>
				{children}
			</View>
		</>
	);

	if (props.pressType === "card") {
		const {
			cardAccessibilityHint,
			cardAccessibilityLabel,
			cardAccessibilityRole = "button",
			cardDisabled = false,
			onPress,
			pressType: _pressType,
			...viewProps
		} = props;

		return (
			<Pressable
				{...viewProps}
				accessible
				accessibilityRole={cardAccessibilityRole}
				accessibilityLabel={cardAccessibilityLabel}
				accessibilityHint={cardAccessibilityHint}
				accessibilityState={{ disabled: cardDisabled }}
				className={cn("relative w-full", className)}
				disabled={cardDisabled}
				onLayout={handleLayout}
				onPress={onPress}
				style={({ pressed }) => [
					{ minHeight: cardHeight },
					style,
					pressed && !cardDisabled ? { opacity: 0.72 } : null,
					cardDisabled ? { opacity: 0.45 } : null,
				]}
			>
				{cardContents}

				<DecorativeAction
					actionIcon={actionIcon}
					actionOffsetBottom={actionOffsetBottom}
					actionOffsetRight={actionOffsetRight}
					actionSize={actionSize}
				/>
			</Pressable>
		);
	}

	const {
		actionAccessibilityHint,
		actionAccessibilityLabel,
		actionDisabled = false,
		onPress,
		pressType: _pressType,
		...viewProps
	} = props;

	return (
		<View
			{...viewProps}
			className={cn("relative w-full", className)}
			onLayout={handleLayout}
			style={[{ minHeight: cardHeight }, style]}
		>
			{cardContents}

			<ActionPressableFrame
				actionAccessibilityHint={actionAccessibilityHint}
				actionAccessibilityLabel={actionAccessibilityLabel}
				actionDisabled={actionDisabled}
				actionIcon={actionIcon}
				actionOffsetBottom={actionOffsetBottom}
				actionOffsetRight={actionOffsetRight}
				actionSize={actionSize}
				onPress={onPress}
			/>
		</View>
	);
}

export function CompactNotchedActionCard({
	cardHeight = COMPACT_CARD_HEIGHT,
	...props
}: NotchedActionCardProps) {
	return <NotchedActionCard {...props} cardHeight={cardHeight} />;
}
