import { useEffect } from "react";
import { TouchableOpacity, useWindowDimensions, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import { parseDayKey } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";
import type { DayEntry } from "~/types/dayEntries";
import {
	getDashboardWeekDayKeys,
	hasDashboardDayEntries,
} from "./dashboard-agenda";

const todayGradient = {
	experimental_backgroundImage: `linear-gradient(to bottom, ${DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors[0]}, ${DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors[1]})`,
};

/** Grow/shrink the circle without scaling the date or delaying selection. */
function DayCircle({
	dayKey,
	number,
	selected,
	today,
	hasEntries,
	artwork = false,
}: {
	dayKey: string;
	number: number;
	selected: boolean;
	today: boolean;
	hasEntries: boolean;
	artwork?: boolean;
}) {
	const { fontScale } = useWindowDimensions();
	const { shouldStackInlineContent } = useContentSizeLayout();
	const diameter =
		!artwork && shouldStackInlineContent ? 44 * Math.max(1, fontScale) : 44;
	const reducedMotion = useReducedMotion();
	const progress = useSharedValue(Number(selected));
	useEffect(() => {
		progress.set(
			reducedMotion || artwork
				? Number(selected)
				: withTiming(Number(selected), {
						duration: 240,
						easing: Easing.out(Easing.cubic),
					}),
		);
	}, [progress, reducedMotion, selected, artwork]);
	const normalStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
	const selectedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: progress.get() }],
	}));
	const selectedNumberStyle = useAnimatedStyle(() => ({
		opacity: progress.get(),
	}));
	return (
		<View
			testID={`calendar-day-size-${dayKey}`}
			// Match the user's uncapped number scaling; enlarged weeks reflow below.
			style={{ width: diameter, height: diameter }}
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<Animated.View
				testID={`calendar-day-normal-${dayKey}`}
				style={normalStyle}
				className="absolute inset-0 items-center justify-center"
			>
				<Text
					allowFontScaling={!artwork}
					className={cn(
						"font-poppins font-semibold text-body-1",
						today ? "text-primary-strong" : "text-text",
					)}
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{number}
				</Text>
				{hasEntries ? (
					<View
						testID={`calendar-entry-dot-${dayKey}`}
						accessible={false}
						className="absolute bottom-1 h-1 w-1 rounded-full bg-primary"
					/>
				) : null}
			</Animated.View>
			<Animated.View
				testID={`calendar-day-selection-${dayKey}`}
				style={selectedStyle}
				className="absolute inset-0"
			>
				<View
					testID={`calendar-day-circle-${dayKey}`}
					style={today ? todayGradient : undefined}
					className={cn(
						"h-full w-full items-center justify-center rounded-full",
						today ? "bg-primary" : "bg-button-neutral",
					)}
				/>
			</Animated.View>
			<Animated.View
				style={selectedNumberStyle}
				className="absolute inset-0 items-center justify-center"
			>
				<Text
					allowFontScaling={!artwork}
					testID={`calendar-day-number-${dayKey}`}
					className={cn(
						"font-poppins font-semibold text-body-1",
						today ? "text-white" : "text-background",
					)}
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{number}
				</Text>
			</Animated.View>
		</View>
	);
}

/** Renders stationary weekday labels outside the moving week strip. */
export function CalendarWeekdays({
	artwork = false,
}: {
	artwork?: boolean;
} = {}) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	if (shouldStackInlineContent && !artwork) return null;
	return (
		<View className="mb-2 flex-row" testID="calendar-weekdays">
			{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
				<Text
					allowFontScaling={!artwork}
					key={day}
					className="flex-1 text-center font-poppins text-body-4 text-secondary-text"
				>
					{day}
				</Text>
			))}
		</View>
	);
}

/** Renders a controlled week with animated selection and entry markers. */
export function WeekCalendar({
	weekKey,
	todayKey,
	selectedDayKey,
	entriesByDay,
	onSelectDay,
	mode = "screen",
}: {
	weekKey: string;
	todayKey: string;
	selectedDayKey: string;
	entriesByDay: Record<string, DayEntry[]> | undefined;
} & (
	| { mode?: "screen"; onSelectDay: (dayKey: string) => void }
	| { mode: "artwork"; onSelectDay?: never }
)) {
	const { shouldStackInlineContent: stackForText } = useContentSizeLayout();
	const artwork = mode === "artwork";
	const shouldStackInlineContent = !artwork && stackForText;
	const Control = artwork ? View : TouchableOpacity;
	return (
		<View
			className={cn("pb-3", shouldStackInlineContent ? "gap-3" : "flex-row")}
		>
			{getDashboardWeekDayKeys(weekKey).map((key) => {
				const date = parseDayKey(key);
				if (!date) return null;
				const selected = key === selectedDayKey;
				const today = key === todayKey;
				const hasEntries = hasDashboardDayEntries(entriesByDay?.[key]);
				return (
					<Control
						key={key}
						activeOpacity={0.82}
						accessibilityRole={artwork ? undefined : "button"}
						accessibilityLabel={`${new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(date)}${today ? ", Heute" : ""}${hasEntries ? ", mit Einträgen" : ""}`}
						accessibilityState={{ selected }}
						onPress={artwork ? undefined : () => onSelectDay?.(key)}
						className={cn(
							"min-h-14 items-center",
							shouldStackInlineContent ? "flex-row gap-4" : "flex-1",
						)}
					>
						<DayCircle
							artwork={artwork}
							dayKey={key}
							number={date.getDate()}
							selected={selected}
							today={today}
							hasEntries={hasEntries}
						/>
						{shouldStackInlineContent ? (
							<Text className="min-w-0 flex-1 text-body-4 text-secondary-text">
								{new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(
									date,
								)}
							</Text>
						) : null}
					</Control>
				);
			})}
		</View>
	);
}
