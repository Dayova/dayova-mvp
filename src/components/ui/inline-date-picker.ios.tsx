import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { FeedbackPressable } from "~/components/ui/feedback-pressable";
import { ArrowLeft, ArrowRight, ChevronDown } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { startOfLocalDay } from "~/lib/day-key";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import type { InlineDatePickerProps } from "./inline-date-picker.types";

const monthFormatter = new Intl.DateTimeFormat("de-DE", {
	month: "long",
	year: "numeric",
});
const shortMonthFormatter = new Intl.DateTimeFormat("de-DE", {
	month: "short",
});
const dayFormatter = new Intl.DateTimeFormat("de-DE", {
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric",
});
const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** A fixed six-week grid avoids the graphical iOS picker's delayed row reflow. */
export function InlineDatePicker({
	value,
	minimumDate,
	maximumDate,
	onChange,
}: InlineDatePickerProps) {
	const { colors } = useDayovaTheme();
	const { fontScale } = useWindowDimensions();
	const [width, setWidth] = useState(0);
	const selectedYear = value.getFullYear();
	const selectedMonth = value.getMonth();
	const [month, setMonth] = useState(
		() => new Date(selectedYear, selectedMonth, 1),
	);
	const [choosingMonth, setChoosingMonth] = useState(false);
	const selectedMonthKey = `${selectedYear}-${selectedMonth}`;
	const [previousSelectedMonth, setPreviousSelectedMonth] =
		useState(selectedMonthKey);
	if (previousSelectedMonth !== selectedMonthKey) {
		// Follow controlled month changes without remounting the measured viewport.
		// A remount hides the days until the next native layout.
		setPreviousSelectedMonth(selectedMonthKey);
		setMonth(new Date(selectedYear, selectedMonth, 1));
		setChoosingMonth(false);
	}
	const year = month.getFullYear();
	const monthIndex = month.getMonth();
	const selectedDay = startOfLocalDay(value).getTime();
	const today = startOfLocalDay(new Date()).getTime();
	const minimum = minimumDate
		? startOfLocalDay(minimumDate).getTime()
		: -Infinity;
	const maximum = maximumDate
		? startOfLocalDay(maximumDate).getTime()
		: Infinity;
	// Preserve the seven-day grid only while full-size text fits the viewport.
	const scale = Math.max(1, fontScale);
	const rowHeight = 44 * scale;
	const weekdayHeight = 28 * scale;
	const minimumWidth = 7 * Math.max(44, 24 * scale);
	const useDayList = width > 0 && width < minimumWidth;
	const periodAvailable = (first: Date, last: Date) =>
		first.getTime() <= maximum && last.getTime() >= minimum;
	const canPrevious = choosingMonth
		? periodAvailable(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31))
		: periodAvailable(
				new Date(year, monthIndex - 1, 1),
				new Date(year, monthIndex, 0),
			);
	const canNext = choosingMonth
		? periodAvailable(new Date(year + 1, 0, 1), new Date(year + 1, 11, 31))
		: periodAvailable(
				new Date(year, monthIndex + 1, 1),
				new Date(year, monthIndex + 2, 0),
			);
	const move = (direction: number) =>
		setMonth(
			choosingMonth
				? new Date(year + direction, monthIndex, 1)
				: new Date(year, monthIndex + direction, 1),
		);
	const firstWeekday = (month.getDay() + 6) % 7;
	const days = Array.from(
		{ length: 42 },
		(_, index) => new Date(year, monthIndex, index - firstWeekday + 1),
	);

	return (
		<View
			testID="calendar-viewport"
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			style={{ height: useDayList ? undefined : rowHeight * 7 + weekdayHeight }}
		>
			{width > 0 ? (
				<View style={{ width }}>
					<View
						className={cn(
							"flex-row items-center",
							useDayList && "flex-wrap justify-end",
						)}
						style={{ height: useDayList ? undefined : rowHeight }}
					>
						<FeedbackPressable
							accessibilityRole="button"
							accessibilityLabel={
								choosingMonth ? "Zur Tagesauswahl" : "Monat und Jahr auswählen"
							}
							accessibilityState={{ expanded: choosingMonth }}
							accessibilityValue={{
								text: choosingMonth
									? String(year)
									: monthFormatter.format(month),
							}}
							onPress={() => setChoosingMonth(!choosingMonth)}
							className={cn(
								"flex-row items-center gap-2 px-2",
								useDayList ? "w-full" : "flex-1",
							)}
							style={{ minHeight: rowHeight }}
						>
							<Text className="shrink font-semibold text-body-2 text-text">
								{choosingMonth ? year : monthFormatter.format(month)}
							</Text>
							<ChevronDown size={18} color={colors.primary} />
						</FeedbackPressable>
						{([-1, 1] as const).map((direction) => {
							const enabled = direction === -1 ? canPrevious : canNext;
							const Icon = direction === -1 ? ArrowLeft : ArrowRight;
							return (
								<FeedbackPressable
									key={direction}
									accessibilityRole="button"
									accessibilityLabel={
										choosingMonth
											? direction === -1
												? "Vorheriges Jahr"
												: "Nächstes Jahr"
											: direction === -1
												? "Vorheriger Monat"
												: "Nächster Monat"
									}
									accessibilityState={{ disabled: !enabled }}
									disabled={!enabled}
									onPress={() => move(direction)}
									className={cn(
										"w-11 items-center justify-center",
										!enabled && "opacity-30",
									)}
									style={{ height: rowHeight }}
								>
									<Icon size={24} color={colors.primary} />
								</FeedbackPressable>
							);
						})}
					</View>
					{choosingMonth ? (
						<View className="flex-row flex-wrap pt-4">
							{Array.from(
								{ length: 12 },
								(_, index) => new Date(year, index, 1),
							).map((date) => {
								const enabled = periodAvailable(
									date,
									new Date(year, date.getMonth() + 1, 0),
								);
								return (
									<FeedbackPressable
										key={date.getTime()}
										accessibilityRole="button"
										accessibilityLabel={monthFormatter.format(date)}
										accessibilityState={{ disabled: !enabled }}
										disabled={!enabled}
										onPress={() => {
											setMonth(date);
											setChoosingMonth(false);
										}}
										className={cn(
											"items-center justify-center",
											useDayList ? "w-full" : "w-1/3",
											!enabled && "opacity-30",
										)}
										style={{ minHeight: rowHeight * 1.5 }}
									>
										<Text className="text-body-2 text-text">
											{useDayList
												? monthFormatter.format(date)
												: shortMonthFormatter.format(date)}
										</Text>
									</FeedbackPressable>
								);
							})}
						</View>
					) : (
						<>
							{!useDayList ? (
								<View
									className="flex-row items-center"
									style={{ height: weekdayHeight }}
								>
									{weekdays.map((day) => (
										<Text
											key={day}
											className="flex-1 text-center font-semibold text-body-4 text-secondary-text"
										>
											{day}
										</Text>
									))}
								</View>
							) : null}
							<View>
								{(useDayList
									? days
											.filter((date) => date.getMonth() === monthIndex)
											.map((date) => [date])
									: Array.from({ length: 6 }, (_, week) =>
											days.slice(week * 7, week * 7 + 7),
										)
								).map((week) => (
									<View key={week[0].getTime()} className="flex-row">
										{week.map((date) => {
											const timestamp = date.getTime();
											const selected = timestamp === selectedDay;
											const isToday = timestamp === today;
											const enabled =
												timestamp >= minimum && timestamp <= maximum;
											const cellStyle = useDayList
												? { minHeight: rowHeight }
												: { height: rowHeight };
											if (date.getMonth() !== monthIndex)
												return (
													<View
														key={timestamp}
														className="flex-1 items-center justify-center"
														style={cellStyle}
													/>
												);
											return (
												<FeedbackPressable
													key={timestamp}
													accessibilityRole="button"
													accessibilityLabel={`${dayFormatter.format(date)}${isToday ? ", heute" : ""}`}
													accessibilityState={{
														selected,
														disabled: !enabled,
													}}
													disabled={!enabled}
													onPress={() => onChange(date)}
													className="flex-1 items-center justify-center"
													style={cellStyle}
												>
													<View
														className={cn(
															"w-full justify-center border-primary",
															useDayList
																? "rounded-input px-3 py-2"
																: "items-center rounded-full",
															selected && "bg-primary",
															isToday && !selected && "border",
														)}
														style={{
															maxWidth: useDayList ? undefined : rowHeight - 4,
															minHeight: rowHeight - 4,
														}}
													>
														<Text
															className={cn(
																"text-body-2 text-text",
																selected && "font-semibold text-on-primary",
																!enabled && "opacity-30",
															)}
														>
															{useDayList
																? dayFormatter.format(date)
																: date.getDate()}
														</Text>
													</View>
												</FeedbackPressable>
											);
										})}
									</View>
								))}
							</View>
						</>
					)}
				</View>
			) : null}
		</View>
	);
}
