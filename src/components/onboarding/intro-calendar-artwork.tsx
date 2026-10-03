import { View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { Plus } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { toDashboardAgendaItem } from "~/features/dashboard/dashboard-agenda";
import { DashboardAgendaEntryCard } from "~/features/dashboard/dashboard-product-cards";
import {
	CalendarWeekdays,
	WeekCalendar,
} from "~/features/dashboard/week-calendar";
import { useDayovaTheme } from "~/lib/theme";
import { IntroPhoneFrame } from "./intro-phone-frame";

const day = "2026-10-05";
const entries = [
	{
		id: "intro-math" as Id<"dayEntries">,
		title: "Mathe lernen",
		kind: "Aufgabe",
		time: "16:00",
		durationMinutes: 30,
		notes: "16:00 Uhr · 30 Minuten",
	},
	{
		id: "intro-english" as Id<"dayEntries">,
		title: "Englisch wiederholen",
		kind: "Aufgabe",
		time: "17:00",
		durationMinutes: 20,
		notes: "17:00 Uhr · 20 Minuten",
	},
];
export function IntroCalendarArtwork({
	width,
	height,
}: {
	width: number;
	height: number;
}) {
	const { colors } = useDayovaTheme();
	return (
		<IntroPhoneFrame
			width={width}
			height={height}
			testID="intro-calendar-artwork"
		>
			<View className="mb-6 flex-row items-center justify-between">
				<Text
					allowFontScaling={false}
					className="font-poppins font-semibold text-heading-2 text-text"
				>
					Oktober 2026
				</Text>
				<View className="rounded-full border border-border bg-card px-3 py-2">
					<Text allowFontScaling={false} className="text-body-4 text-text">
						Heute
					</Text>
				</View>
				<Plus size={24} color={colors.primary} />
			</View>
			<CalendarWeekdays artwork />
			<WeekCalendar
				mode="artwork"
				weekKey={day}
				todayKey={day}
				selectedDayKey={day}
				entriesByDay={{ [day]: entries }}
			/>
			<View className="my-5 h-px bg-border" />
			<Text
				allowFontScaling={false}
				className="mb-4 font-poppins font-semibold text-body-2 text-text"
			>
				Dein Nachmittag
			</Text>
			<View className="gap-3">
				{entries.map((entry) => (
					<View key={entry.id} className="h-[100px]">
						<DashboardAgendaEntryCard
							mode="artwork"
							item={toDashboardAgendaItem(day, entry)}
						/>
					</View>
				))}
			</View>
		</IntroPhoneFrame>
	);
}
