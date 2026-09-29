import { useEffect } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
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
}: {
	dayKey: string;
	number: number;
	selected: boolean;
	today: boolean;
	hasEntries: boolean;
}) {
	const reducedMotion = useReducedMotion();
	const progress = useSharedValue(Number(selected));
	useEffect(() => {
		progress.set(
			reducedMotion
				? Number(selected)
				: withTiming(Number(selected), {
						duration: 240,
						easing: Easing.out(Easing.cubic),
					}),
		);
	}, [progress, reducedMotion, selected]);
	const normalStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
	const selectedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: progress.get() }],
	}));
	const selectedNumberStyle = useAnimatedStyle(() => ({
		opacity: progress.get(),
	}));
	return (
		<View
			className="h-11 w-11"
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
						"h-11 w-11 items-center justify-center rounded-full",
						today ? "bg-primary" : "bg-button-neutral",
					)}
				/>
			</Animated.View>
			<Animated.View
				style={selectedNumberStyle}
				className="absolute inset-0 items-center justify-center"
			>
				<Text
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
export function CalendarWeekdays() {
	return (
		<View className="mb-2 flex-row" testID="calendar-weekdays">
			{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
				<Text
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
}: {
	weekKey: string;
	todayKey: string;
	selectedDayKey: string;
	entriesByDay: Record<string, DayEntry[]> | undefined;
	onSelectDay: (dayKey: string) => void;
}) {
	return (
		<View className="flex-row pb-3">
			{getDashboardWeekDayKeys(weekKey).map((key) => {
				const date = parseDayKey(key);
				if (!date) return null;
				const selected = key === selectedDayKey;
				const today = key === todayKey;
				const hasEntries = hasDashboardDayEntries(entriesByDay?.[key]);
				return (
					<TouchableOpacity
						key={key}
						activeOpacity={0.82}
						accessibilityRole="button"
						accessibilityLabel={`${new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(date)}${today ? ", Heute" : ""}${hasEntries ? ", mit Einträgen" : ""}`}
						accessibilityState={{ selected }}
						onPress={() => onSelectDay(key)}
						className="min-h-14 flex-1 items-center"
					>
						<DayCircle
							dayKey={key}
							number={date.getDate()}
							selected={selected}
							today={today}
							hasEntries={hasEntries}
						/>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}
