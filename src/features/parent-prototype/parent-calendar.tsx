import { useState } from "react";
import { View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { CalendarPager } from "~/features/dashboard/calendar-pager";
import { CompactDayAgenda } from "~/features/dashboard/compact-day-agenda";
import {
	type DashboardAgendaItem,
	getDashboardWeekDayKeys,
} from "~/features/dashboard/dashboard-agenda";
import { DashboardCalendarHeader } from "~/features/dashboard/dashboard-calendar-header";
import {
	CalendarWeekdays,
	WeekCalendar,
} from "~/features/dashboard/week-calendar";
import { parseDayKey } from "~/lib/day-key";

const weeks = ["2026-10-12", "2026-10-19", "2026-10-26"];
const days = weeks.flatMap(getDashboardWeekDayKeys);
const items: DashboardAgendaItem[] = [
	{
		dayKey: "2026-10-15",
		kind: "learningSession",
		startMinutes: 960,
		endMinutes: 980,
		entry: {
			id: "parent-calendar-session" as Id<"learningPlanSessions">,
			subject: "Mathematik",
			title: "Brüche auf einen Nenner bringen",
			time: "16:00",
			durationMinutes: 20,
			kind: "learningSession",
		},
	},
	{
		dayKey: "2026-10-16",
		kind: "homework",
		startMinutes: null,
		endMinutes: null,
		entry: {
			id: "parent-calendar-homework" as Id<"dayEntries">,
			subject: "Mathematik",
			title: "Brüche kürzen",
			kind: "homework",
		},
	},
	{
		dayKey: "2026-10-19",
		kind: "homework",
		startMinutes: null,
		endMinutes: null,
		entry: {
			id: "parent-calendar-german" as Id<"dayEntries">,
			subject: "Deutsch",
			title: "Eine Fabel lesen",
			kind: "homework",
		},
	},
	{
		dayKey: "2026-10-20",
		kind: "exam",
		startMinutes: null,
		endMinutes: null,
		entry: {
			id: "parent-calendar-exam" as Id<"dayEntries">,
			subject: "Mathematik",
			title: "Brüche verstehen",
			kind: "exam",
			examTypeLabel: "Klassenarbeit",
		},
	},
	{
		dayKey: "2026-10-23",
		kind: "exam",
		startMinutes: null,
		endMinutes: null,
		entry: {
			id: "parent-calendar-test" as Id<"dayEntries">,
			subject: "Englisch",
			title: "Simple past",
			kind: "exam",
			examTypeLabel: "Test",
		},
	},
];
const entriesByDay = Object.fromEntries(
	days.map((day) => [
		day,
		items.filter((item) => item.dayKey === day).map((item) => item.entry),
	]),
);
export function ParentCalendar({
	onPlan,
	onHomework,
}: {
	onPlan: (index: number) => void;
	onHomework: (index: number) => void;
}) {
	const [selected, setSelected] = useState("2026-10-15");
	return (
		<View className="gap-4">
			<View>
				<DashboardCalendarHeader
					selectedDate={parseDayKey(selected) ?? new Date(2026, 9, 15)}
					onToday={() => setSelected("2026-10-15")}
				/>
				<CalendarWeekdays />
				<CalendarPager
					testID="parent-week-pager"
					keys={weeks}
					selectedKey={getDashboardWeekDayKeys(selected)[0]}
					minimumHeight={68}
					onSelect={setSelected}
					renderPage={(weekKey) => (
						<WeekCalendar
							weekKey={weekKey}
							todayKey="2026-10-15"
							selectedDayKey={selected}
							entriesByDay={entriesByDay}
							onSelectDay={setSelected}
						/>
					)}
				/>
			</View>
			<CalendarPager
				testID="parent-day-pager"
				keys={days}
				selectedKey={selected}
				minimumHeight={150}
				onSelect={setSelected}
				renderPage={(day) => (
					<CompactDayAgenda
						isLoading={false}
						items={items.filter((item) => item.dayKey === day)}
						onOpenItem={(item) =>
							item.kind === "homework"
								? onHomework(item.entry.subject === "Deutsch" ? 1 : 0)
								: onPlan(item.entry.subject === "Englisch" ? 1 : 0)
						}
					/>
				)}
			/>
		</View>
	);
}
