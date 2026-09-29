import { TouchableOpacity, View } from "react-native";
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
						<View
							testID={`calendar-day-circle-${key}`}
							style={selected && today ? todayGradient : undefined}
							className={cn(
								"h-11 w-11 items-center justify-center rounded-full",
								selected
									? today
										? "bg-primary"
										: "bg-button-neutral"
									: "bg-transparent",
							)}
						>
							<Text
								testID={`calendar-day-number-${key}`}
								className={cn(
									"font-poppins font-semibold text-body-1",
									selected
										? today
											? "text-white"
											: "text-background"
										: today
											? "text-primary-strong"
											: "text-text",
								)}
								style={{ fontVariant: ["tabular-nums"] }}
							>
								{date.getDate()}
							</Text>
							{hasEntries && !selected ? (
								<View
									testID={`calendar-entry-dot-${key}`}
									accessible={false}
									className="absolute bottom-1 h-1 w-1 rounded-full bg-primary"
								/>
							) : null}
						</View>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}
