import {
	type ComponentProps,
	createContext,
	type ReactNode,
	use,
	useEffect,
} from "react";
import { Pressable, View } from "react-native";
import Animated, {
	Easing,
	interpolateColor,
	type SharedValue,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const SETTLE = { duration: 240, dampingRatio: 0.8 };
const AnimatedText = Animated.createAnimatedComponent(Text);
type Appearance = "card" | "pill" | "payment";
type SelectionColors = {
	background: string;
	selectedBackground: string;
	border: string;
	selectedBorder: string;
	text: string;
	selectedText: string;
	indicator: string;
	onIndicator: string;
	emptyIndicator: string;
	indicatorBorder: string;
	badge: string;
	badgeText: string;
};
const SelectionContext = createContext<{
	progress: SharedValue<number>;
	checkScale: SharedValue<number>;
	colors: SelectionColors;
} | null>(null);
function useSelection() {
	const selection = use(SelectionContext);
	if (!selection)
		throw new Error("Selection content requires a SelectionControl.");
	return selection;
}

// The branded payment surface deliberately stays light in both app themes.
const PAYMENT_COLORS: SelectionColors = {
	background: "rgba(255, 255, 255, 0.8)",
	selectedBackground: "rgba(255, 255, 255, 0.8)",
	border: "rgba(255, 255, 255, 0.6)",
	selectedBorder: DAYOVA_DESIGN_SYSTEM.colors.text,
	text: DAYOVA_DESIGN_SYSTEM.colors.text,
	selectedText: DAYOVA_DESIGN_SYSTEM.colors.text,
	indicator: DAYOVA_DESIGN_SYSTEM.colors.text,
	onIndicator: DAYOVA_DESIGN_SYSTEM.colors.light1,
	emptyIndicator: DAYOVA_DESIGN_SYSTEM.colors.light1,
	indicatorBorder: DAYOVA_DESIGN_SYSTEM.colors.border,
	badge: DAYOVA_DESIGN_SYSTEM.colors.light2,
	badgeText: DAYOVA_DESIGN_SYSTEM.colors.secondaryText,
};

type SelectionControlProps = Omit<
	ComponentProps<typeof Pressable>,
	"children" | "style" | "accessibilityRole" | "onPressIn" | "onPressOut"
> & {
	selected: boolean;
	accessibilityRole?: "radio" | "checkbox";
	appearance?: Appearance;
	contentClassName?: string;
	children: ReactNode;
};

/** A controlled choice: selection is immediate; motion never commits state. */
export function SelectionControl({
	selected,
	disabled: disabledProp,
	accessibilityRole = "radio",
	accessibilityState,
	appearance = "card",
	className,
	contentClassName,
	children,
	...props
}: SelectionControlProps) {
	const disabled = Boolean(disabledProp);
	const { colors: theme } = useDayovaTheme();
	const colors: SelectionColors =
		appearance === "payment"
			? PAYMENT_COLORS
			: {
					background:
						appearance === "pill" ? theme.systemSubtle : theme.surface,
					selectedBackground:
						appearance === "pill" ? theme.primary : theme.systemSubtle,
					border: theme.border,
					selectedBorder: theme.primary,
					text: theme.text,
					selectedText: appearance === "pill" ? theme.onPrimary : theme.text,
					indicator: theme.primary,
					onIndicator: theme.onPrimary,
					emptyIndicator: "transparent",
					indicatorBorder: theme.secondaryText,
					badge: theme.light2,
					badgeText: theme.secondaryText,
				};
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
	const surfaceStyle = useAnimatedStyle(() => ({
		transform: [{ scale: pressScale.get() }],
		backgroundColor: interpolateColor(
			progress.get(),
			[0, 1],
			[colors.background, colors.selectedBackground],
		),
		borderColor: interpolateColor(
			progress.get(),
			[0, 1],
			[colors.border, colors.selectedBorder],
		),
	}));
	// Preserve the branded card's existing native inset highlight and selection shadow.
	const paymentShadowStyle =
		appearance === "payment"
			? {
					boxShadow: selected
						? "inset 0 1px 0 rgba(255, 255, 255, 0.64), 0 8px 20px rgba(9, 54, 78, 0.1)"
						: "inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 6px 16px rgba(9, 54, 78, 0.08)",
				}
			: undefined;
	return (
		<SelectionContext value={{ progress, checkScale, colors }}>
			<Pressable
				{...props}
				className={className}
				disabled={disabled}
				accessibilityRole={accessibilityRole}
				accessibilityState={{
					...accessibilityState,
					checked: selected,
					disabled,
				}}
				onPressIn={() => {
					if (!disabled && !reduceMotion)
						pressScale.set(withTiming(0.98, { duration: 90 }));
				}}
				onPressOut={() =>
					pressScale.set(reduceMotion ? 1 : withSpring(1, SETTLE))
				}
			>
				{/* Only the presentation scales; its outer native hit area stays fixed. */}
				<Animated.View
					style={[paymentShadowStyle, surfaceStyle]}
					className={cn(
						"min-h-12 border",
						appearance === "pill"
							? "items-center justify-center rounded-full"
							: "rounded-[24px]",
						contentClassName,
					)}
				>
					{children}
				</Animated.View>
			</Pressable>
		</SelectionContext>
	);
}

/** Keep the slot mounted so selecting cannot move labels or shrink hit areas. */
export function SelectionIndicator({
	plain = false,
	className,
	testID,
}: {
	plain?: boolean;
	className?: string;
	testID?: string;
}) {
	const { progress, checkScale, colors } = useSelection();
	const checkStyle = useAnimatedStyle(() => ({
		opacity: progress.get(),
		transform: [{ scale: checkScale.get() }],
	}));
	const ringStyle = useAnimatedStyle(() => ({
		backgroundColor: colors.emptyIndicator,
		borderColor: interpolateColor(
			progress.get(),
			[0, 1],
			[colors.indicatorBorder, colors.indicator],
		),
	}));
	const fillStyle = useAnimatedStyle(() => ({
		backgroundColor: colors.indicator,
	}));
	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			testID={testID}
			className={cn(
				plain ? "h-4 w-4" : "h-6 w-6",
				"shrink-0 items-center justify-center",
				className,
			)}
		>
			{plain ? (
				<Animated.View style={checkStyle}>
					<Check size={16} color={colors.onIndicator} strokeWidth={2.8} />
				</Animated.View>
			) : (
				<>
					{/* Reanimated owns the selected fill and border across theme changes. */}
					<Animated.View
						className="absolute h-6 w-6 rounded-full border-2"
						style={ringStyle}
					/>
					<Animated.View
						className="absolute h-6 w-6 items-center justify-center rounded-full"
						style={[fillStyle, checkStyle]}
					>
						<Check size={14} color={colors.onIndicator} strokeWidth={2.8} />
					</Animated.View>
				</>
			)}
		</View>
	);
}

export function SelectionText({
	style,
	...props
}: ComponentProps<typeof Text>) {
	const { progress, colors } = useSelection();
	const textStyle = useAnimatedStyle(() => ({
		color: interpolateColor(
			progress.get(),
			[0, 1],
			[colors.text, colors.selectedText],
		),
	}));
	// Foreground transitions with the selected surface, including filled pills.
	return <AnimatedText {...props} style={[style, textStyle]} />;
}

export function SelectionBadge({ children }: { children: string }) {
	const { progress, colors } = useSelection();
	const badgeStyle = useAnimatedStyle(() => ({
		backgroundColor: interpolateColor(
			progress.get(),
			[0, 1],
			[colors.badge, colors.indicator],
		),
	}));
	const textStyle = useAnimatedStyle(() => ({
		color: interpolateColor(
			progress.get(),
			[0, 1],
			[colors.badgeText, colors.onIndicator],
		),
	}));
	return (
		<Animated.View
			accessible={false}
			className="h-8 w-8 shrink-0 items-center justify-center rounded-xl"
			style={badgeStyle}
		>
			<AnimatedText
				className="font-poppins font-semibold text-body-4"
				style={textStyle}
			>
				{children}
			</AnimatedText>
		</Animated.View>
	);
}
