import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	ReduceMotion,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { Computer, Moon, Sun } from "~/components/ui/icon";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import { THEME_OPTIONS, type ThemePreference } from "~/lib/theme-preference";

const themeIconByPreference = { light: Sun, system: Computer, dark: Moon };
const OPTION_SIZE = 44;
const SELECTION_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;

export function ThemePreferenceToggle({
	preference,
	setPreference,
}: {
	preference: ThemePreference;
	setPreference: (preference: ThemePreference) => Promise<void>;
}) {
	const selectedIndex = THEME_OPTIONS.findIndex(
		(option) => option.value === preference,
	);
	const selectionPosition = useSharedValue(selectedIndex);
	const indicatorStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: selectionPosition.get() * OPTION_SIZE }],
	}));

	useEffect(() => {
		selectionPosition.set(
			withTiming(selectedIndex, {
				duration: 240,
				easing: Easing.out(Easing.cubic),
				reduceMotion: ReduceMotion.System,
			}),
		);
	}, [selectedIndex, selectionPosition]);

	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel="Design"
			className="flex-row rounded-full border border-border/70 bg-muted p-1"
		>
			<Animated.View
				testID="theme-selection-indicator"
				pointerEvents="none"
				style={[styles.indicator, indicatorStyle]}
			>
				<LinearGradient
					colors={SELECTION_GRADIENT.colors}
					start={SELECTION_GRADIENT.start}
					end={SELECTION_GRADIENT.end}
					style={StyleSheet.absoluteFill}
				/>
			</Animated.View>
			{THEME_OPTIONS.map((option, index) => (
				<Pressable
					key={option.value}
					accessibilityLabel={option.accessibilityLabel}
					accessibilityRole="radio"
					accessibilityState={{ checked: preference === option.value }}
					className="h-11 w-11 items-center justify-center rounded-full"
					onPress={() => {
						if (preference === option.value) return;
						void setPreference(option.value).catch((error: unknown) => {
							console.warn("Unable to save Dayova theme preference", error);
						});
					}}
				>
					<ThemeOptionIcon
						preference={option.value}
						index={index}
						selectionPosition={selectionPosition}
					/>
				</Pressable>
			))}
		</View>
	);
}

function ThemeOptionIcon({
	preference,
	index,
	selectionPosition,
}: {
	preference: ThemePreference;
	index: number;
	selectionPosition: SharedValue<number>;
}) {
	const { colors } = useDayovaTheme();
	const Icon = themeIconByPreference[preference];
	const inactiveStyle = useAnimatedStyle(() => ({
		opacity: Math.min(Math.abs(selectionPosition.get() - index), 1),
	}));
	const activeStyle = useAnimatedStyle(() => ({
		opacity: 1 - Math.min(Math.abs(selectionPosition.get() - index), 1),
	}));
	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<Animated.View style={inactiveStyle}>
				<Icon size={20} color={colors.secondaryText} strokeWidth={2} />
			</Animated.View>
			<Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
				<Icon size={20} color="#FFFFFF" strokeWidth={2} />
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	indicator: {
		position: "absolute",
		left: 4,
		top: 4,
		width: OPTION_SIZE,
		height: OPTION_SIZE,
		borderRadius: OPTION_SIZE / 2,
		overflow: "hidden",
	},
});
