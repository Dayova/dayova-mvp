import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
	Easing,
	interpolateColor,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { SelectionIndicator } from "~/components/ui/selection-indicator";
import { Text } from "~/components/ui/text";
import type { SessionContentItem } from "~/features/learning-plans/types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const SETTLE = { duration: 240, dampingRatio: 0.8 };

export function ChoiceList({
	item,
	selectedChoiceId,
	onSelect,
	disabled,
}: {
	item: Pick<SessionContentItem, "id" | "choices">;
	selectedChoiceId: string | null;
	onSelect: (choiceId: string) => void;
	disabled: boolean;
}) {
	return (
		<View className="mt-5 gap-3" accessibilityRole="radiogroup">
			{item.choices.map((choice, index) => (
				<ChoiceCard
					key={`${item.id}:${choice.id}`}
					label={String.fromCharCode(65 + index)}
					text={choice.text}
					selected={selectedChoiceId === choice.id}
					disabled={disabled}
					onSelect={() => onSelect(choice.id)}
				/>
			))}
		</View>
	);
}

function ChoiceCard({
	label,
	text,
	selected,
	disabled,
	onSelect,
}: {
	label: string;
	text: string;
	selected: boolean;
	disabled: boolean;
	onSelect: () => void;
}) {
	const { colors } = useDayovaTheme();
	const reduceMotion = useReducedMotion();
	const selection = useSharedValue(selected ? 1 : 0);
	const pressScale = useSharedValue(1);

	useEffect(() => {
		selection.set(
			reduceMotion
				? Number(selected)
				: withTiming(Number(selected), {
						duration: 180,
						easing: Easing.out(Easing.cubic),
					}),
		);
	}, [reduceMotion, selected, selection]);

	useEffect(() => {
		if (disabled || reduceMotion) pressScale.set(1);
	}, [disabled, pressScale, reduceMotion]);

	const cardStyle = useAnimatedStyle(() => ({
		transform: [{ scale: pressScale.get() }],
		borderColor: interpolateColor(
			selection.get(),
			[0, 1],
			[colors.border, `${colors.primary}66`],
		),
	}));
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={`${label}. ${text}`}
			accessibilityState={{ checked: selected, disabled }}
			disabled={disabled}
			onPress={onSelect}
			onPressIn={() => {
				if (!disabled && !reduceMotion)
					pressScale.set(withTiming(0.98, { duration: 90 }));
			}}
			onPressOut={() => {
				pressScale.set(reduceMotion ? 1 : withSpring(1, SETTLE));
			}}
		>
			{/* Reanimated owns motion and interpolated theme colors; the hit area stays fixed. */}
			<Animated.View
				className={cn(
					"min-h-16 flex-row items-center gap-4 rounded-3xl border px-5 py-3",
					selected ? "bg-accent" : "bg-card",
				)}
				style={cardStyle}
			>
				<View className="h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-system-subtle">
					{selected ? (
						<LinearGradient
							{...DAYOVA_DESIGN_SYSTEM.gradients.selection}
							// Native gradient geometry fills the letter badge.
							style={{
								position: "absolute",
								top: 0,
								right: 0,
								bottom: 0,
								left: 0,
							}}
						/>
					) : null}
					<Text
						className={cn(
							"font-poppins font-semibold text-body-4",
							selected ? "text-white" : "text-secondary-text",
						)}
					>
						{label}
					</Text>
				</View>
				<Text
					className={cn(
						"flex-1 font-poppins text-body-2",
						selected ? "font-semibold text-primary" : "text-text",
					)}
				>
					{text}
				</Text>
				<SelectionIndicator selected={selected} />
			</Animated.View>
		</Pressable>
	);
}
