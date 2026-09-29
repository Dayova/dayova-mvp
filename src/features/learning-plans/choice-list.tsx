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
import { Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import type { SessionContentItem } from "~/features/learning-plans/types";
import { useDayovaTheme } from "~/lib/theme";

const SETTLE = { duration: 240, dampingRatio: 0.8 };
const AnimatedText = Animated.createAnimatedComponent(Text);

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
		<View className="mt-5 gap-2" accessibilityRole="radiogroup">
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
	const checkScale = useSharedValue(selected ? 1 : 0.6);
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
		checkScale.set(reduceMotion ? 1 : withSpring(selected ? 1 : 0.6, SETTLE));
	}, [checkScale, reduceMotion, selected, selection]);

	useEffect(() => {
		if (disabled || reduceMotion) pressScale.set(1);
	}, [disabled, pressScale, reduceMotion]);

	const cardStyle = useAnimatedStyle(() => ({
		transform: [{ scale: pressScale.get() }],
		backgroundColor: interpolateColor(
			selection.get(),
			[0, 1],
			[colors.surface, colors.systemSubtle],
		),
		borderColor: interpolateColor(
			selection.get(),
			[0, 1],
			[colors.border, colors.primary],
		),
	}));
	const badgeStyle = useAnimatedStyle(() => ({
		backgroundColor: interpolateColor(
			selection.get(),
			[0, 1],
			[colors.light2, colors.primary],
		),
	}));
	const badgeTextStyle = useAnimatedStyle(() => ({
		color: interpolateColor(
			selection.get(),
			[0, 1],
			[colors.secondaryText, colors.onPrimary],
		),
	}));
	const checkStyle = useAnimatedStyle(() => ({
		opacity: selection.get(),
		transform: [{ scale: checkScale.get() }],
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
				className="min-h-14 flex-row items-center gap-3 rounded-[24px] border-hairline px-4 py-3 shadow-black/5 shadow-sm"
				style={cardStyle}
			>
				<Animated.View
					className="h-8 w-8 shrink-0 items-center justify-center rounded-xl"
					style={badgeStyle}
				>
					<AnimatedText
						className="font-poppins font-semibold text-body-4"
						style={badgeTextStyle}
					>
						{label}
					</AnimatedText>
				</Animated.View>
				<Text className="flex-1 font-poppins text-body-3 text-text">
					{text}
				</Text>
				<View className="h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary-text/50">
					<Animated.View
						className="absolute h-6 w-6 items-center justify-center rounded-full bg-primary"
						style={checkStyle}
					>
						<Check size={14} color={colors.onPrimary} strokeWidth={2.8} />
					</Animated.View>
				</View>
			</Animated.View>
		</Pressable>
	);
}
