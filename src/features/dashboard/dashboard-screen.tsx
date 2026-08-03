import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ScrollView,
	type TextStyle,
	TouchableOpacity,
	View,
	type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { api } from "#convex/_generated/api";
import { NotificationButton } from "~/components/notification-button";
import {
	ArrowRight,
	ArrowUpRight,
	Backpack,
	BookOpen,
	CalendarDays,
	Check,
	Clock3,
	Dumbbell,
	ScanImage,
	TimeManagement,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { getDayKey, parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { triggerSelectionHaptic } from "~/lib/safe-haptics";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import type { DayEntry } from "~/types/dayEntries";
import {
	type DashboardAgendaItem,
	type DashboardWeekProgress,
	findNextActionableAgendaItem,
	getAgendaEntryTitle,
	getDashboardCalendarDayKeys,
	getDashboardRelevantDayKeys,
	getDashboardWeekDayKeys,
	getDashboardWeekProgress,
	getDashboardWeekProgressFooter,
	isDashboardAgendaItemPast,
	sortDashboardAgendaItems,
	toDashboardAgendaItem,
} from "./dashboard-agenda";

const triggerDaySelectionHaptic = () => {
	void triggerSelectionHaptic({
		platform: process.env.EXPO_OS,
		selectionAsync: () => Haptics.selectionAsync(),
	});
};

// These are native rendering controls with no NativeWind equivalent.
const continuousBorderStyle = {
	borderCurve: "continuous",
} satisfies ViewStyle;
const tabularNumberStyle = {
	fontVariant: ["tabular-nums"],
} satisfies TextStyle;

type CalendarDay = {
	key: string;
	date: Date;
	weekday: string;
	dayOfMonth: string;
	isToday: boolean;
};

type AgendaDay = CalendarDay & {
	items: DashboardAgendaItem[];
};

const toCalendarDay = ({
	dayKey,
	todayKey,
}: {
	dayKey: string;
	todayKey: string;
}): CalendarDay | null => {
	const date = parseDayKey(dayKey);
	if (!date) return null;

	return {
		key: dayKey,
		date,
		weekday: new Intl.DateTimeFormat("de-DE", {
			weekday: "short",
		})
			.format(date)
			.replace(".", "")
			.slice(0, 2),
		dayOfMonth: date.getDate().toString(),
		isToday: dayKey === todayKey,
	};
};

const formatMinutes = (minutes: number) => {
	const hours = Math.floor(minutes / 60)
		.toString()
		.padStart(2, "0");
	const remainder = (minutes % 60).toString().padStart(2, "0");
	return `${hours}:${remainder}`;
};

const getTimeLabel = (item: DashboardAgendaItem) => {
	if (item.startMinutes === null) return "Ganztägig";
	if (item.endMinutes === null) return formatMinutes(item.startMinutes);
	return `${formatMinutes(item.startMinutes)}–${formatMinutes(item.endMinutes)}`;
};

const getEntryUrl = (entry: DayEntry, selectedDayLabel: string) => {
	if (entry.relatedLearningPlanId && entry.relatedLearningPlanSessionId) {
		return `/learning-plans/${encodeURIComponent(entry.relatedLearningPlanId)}/sessions/${encodeURIComponent(entry.relatedLearningPlanSessionId)}`;
	}
	if (entry.relatedLearningPlanId) {
		return `/learning-plans/${encodeURIComponent(entry.relatedLearningPlanId)}`;
	}

	const details: Array<[string, string]> = [
		["title", formatGermanUiText(getAgendaEntryTitle(entry))],
		["day", selectedDayLabel],
	];
	if (entry.kind) details.push(["kind", formatGermanUiText(entry.kind)]);
	if (entry.notes) details.push(["notes", entry.notes]);
	if (entry.examTypeLabel)
		details.push(["examType", formatGermanUiText(entry.examTypeLabel)]);
	if (entry.dueDateLabel) details.push(["dueDate", entry.dueDateLabel]);
	if (entry.plannedDateLabel)
		details.push(["plannedDate", entry.plannedDateLabel]);
	if (entry.durationMinutes)
		details.push(["duration", `${entry.durationMinutes}`]);
	if (entry.time) details.push(["time", entry.time]);

	const query = details
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("&");
	return `/entry/${encodeURIComponent(entry.id)}?${query}`;
};

const getMonthHeading = (date: Date) =>
	formatGermanUiText(
		new Intl.DateTimeFormat("de-DE", {
			month: "long",
			year: "numeric",
		}).format(date),
	);

const getEntrySummary = (entry: DayEntry) => {
	const firstNoteLine = entry.notes
		?.split("\n")
		.map((line) => line.replace(/^-\s*/, "").trim())
		.find(Boolean);
	if (firstNoteLine) return formatGermanUiText(firstNoteLine);
	if (entry.examTypeLabel) return formatGermanUiText(entry.examTypeLabel);
	if (entry.kind) return formatGermanUiText(entry.kind);
	return "Für deinen Tag eingeplant";
};

const getNextStepDateLabel = (item: DashboardAgendaItem, todayKey: string) => {
	const date = parseDayKey(item.dayKey);
	if (!date) return "Termin folgt";
	if (item.dayKey === todayKey) return "Heute";

	return formatGermanUiText(
		new Intl.DateTimeFormat("de-DE", {
			weekday: "short",
			day: "numeric",
			month: "short",
		}).format(date),
	);
};

const getNextStepTimeLabel = (item: DashboardAgendaItem) => {
	const durationMinutes = item.entry.durationMinutes ?? 45;
	if (item.startMinutes === null) return `${durationMinutes} Min.`;
	return `${formatMinutes(item.startMinutes)} Uhr · ${durationMinutes} Min.`;
};

const getNextStepFooter = (item: DashboardAgendaItem, todayKey: string) => {
	if (item.entry.executionStatus === "started") return "Fortsetzen";
	if (item.dayKey === todayKey) return "Jetzt starten";
	return "Lernschritt öffnen";
};

const WEEK_PROGRESS_RING_SIZE = 112;
const WEEK_PROGRESS_RING_STROKE_WIDTH = 9;
const WEEK_PROGRESS_RING_RADIUS =
	(WEEK_PROGRESS_RING_SIZE - WEEK_PROGRESS_RING_STROKE_WIDTH) / 2;
const WEEK_PROGRESS_RING_CIRCUMFERENCE =
	2 * Math.PI * WEEK_PROGRESS_RING_RADIUS;

function WeekCalendar({
	days,
	selectedDayKey,
	onSelectDay,
}: {
	days: CalendarDay[];
	selectedDayKey: string;
	onSelectDay: (day: CalendarDay) => void;
}) {
	return (
		<View className="flex-row border-border border-b pb-5">
			{days.map((day) => {
				const selected = day.key === selectedDayKey;
				return (
					<TouchableOpacity
						key={day.key}
						activeOpacity={0.82}
						accessibilityRole="button"
						accessibilityLabel={new Intl.DateTimeFormat("de-DE", {
							weekday: "long",
							day: "numeric",
							month: "long",
						}).format(day.date)}
						accessibilityState={{ selected }}
						onPress={() => onSelectDay(day)}
						hitSlop={2}
						className="min-h-20 flex-1 items-center justify-start"
					>
						<Text className="font-poppins text-body-4 text-secondary-text">
							{day.weekday}
						</Text>
						<View
							className={cn(
								"mt-2 h-12 w-12 items-center justify-center rounded-full border",
								selected
									? "border-primary-strong/30 bg-system-subtle"
									: "border-transparent bg-transparent",
							)}
							style={continuousBorderStyle}
						>
							<Text
								className={cn(
									"font-poppins font-semibold text-body-1",
									selected ? "text-primary-strong" : "text-text",
								)}
								style={tabularNumberStyle}
							>
								{day.dayOfMonth}
							</Text>
							{day.isToday && !selected ? (
								<View className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
							) : null}
						</View>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

function TimelineRail({
	isFirst,
	isLast,
	isPast,
	isPrimary,
}: {
	isFirst: boolean;
	isLast: boolean;
	isPast: boolean;
	isPrimary: boolean;
}) {
	return (
		<View className="w-5 items-center self-stretch">
			{!isFirst ? (
				<View
					className={cn(
						"absolute top-0 h-4 w-px",
						isPast ? "bg-path-1/60" : "bg-path-1",
					)}
				/>
			) : null}
			<View
				className={cn(
					"z-10 mt-3 h-3 w-3 rounded-full border-2",
					isPrimary
						? "border-primary bg-primary"
						: isPast
							? "border-path-2 bg-background"
							: "border-path-3 bg-background",
				)}
			/>
			{!isLast ? (
				<View
					className={cn(
						"absolute top-6 bottom-0 w-px",
						isPast ? "bg-path-1/60" : "bg-path-1",
					)}
				/>
			) : null}
		</View>
	);
}

function SchoolLessonCard({
	item,
	isPast,
}: {
	item: DashboardAgendaItem;
	isPast: boolean;
}) {
	const { colors } = useDayovaTheme();
	return (
		<View
			accessible
			accessibilityLabel={`Schulstunde: ${formatGermanUiText(getAgendaEntryTitle(item.entry))}, ${getTimeLabel(item)}`}
			className={cn(
				"min-h-20 flex-row items-center rounded-3xl border border-border bg-light-2 px-4 py-3",
				isPast && "opacity-55",
			)}
			style={continuousBorderStyle}
		>
			<View className="h-10 w-10 items-center justify-center rounded-full bg-card">
				<BookOpen size={19} color={colors.secondaryText} strokeWidth={1.9} />
			</View>
			<View className="ml-3 flex-1">
				<Text className="font-poppins text-body-5 text-secondary-text">
					Schule
				</Text>
				<Text
					className="font-poppins font-semibold text-body-3 text-text"
					numberOfLines={1}
				>
					{formatGermanUiText(getAgendaEntryTitle(item.entry))}
				</Text>
			</View>
		</View>
	);
}

function LearningSessionCard({
	item,
	isPast,
	onPress,
}: {
	item: DashboardAgendaItem;
	isPast: boolean;
	onPress: () => void;
}) {
	const isStarted = item.entry.executionStatus === "started";

	return (
		<TouchableOpacity
			activeOpacity={0.86}
			accessibilityRole="button"
			accessibilityLabel={`${isStarted ? "Weiterlernen" : "Lernsession starten"}: ${formatGermanUiText(getAgendaEntryTitle(item.entry))}`}
			onPress={onPress}
			className={cn(
				"min-h-24 overflow-hidden rounded-card border border-border bg-card",
				isPast && "opacity-55",
			)}
			style={continuousBorderStyle}
		>
			<View className="min-h-24 justify-center px-5 py-4">
				<View className="flex-row items-center">
					<View className="h-10 w-10 items-center justify-center rounded-full bg-ueben-subtle">
						<Dumbbell
							size={19}
							color={DAYOVA_DESIGN_SYSTEM.colors.ueben}
							strokeWidth={2}
						/>
					</View>
					<View className="ml-3 flex-1">
						<View className="mb-1 flex-row items-center justify-between gap-2">
							<Text className="font-poppins font-semibold text-body-5 text-ueben">
								Dein Lernschritt
							</Text>
							{!isPast ? (
								<View className="h-7 justify-center rounded-full bg-light-2 px-3">
									<Text className="font-poppins font-semibold text-body-5 text-secondary-text">
										{`${item.entry.durationMinutes ?? 45} min`}
									</Text>
								</View>
							) : null}
						</View>
						<Text
							className="font-poppins font-semibold text-body-2 text-text"
							numberOfLines={2}
						>
							{formatGermanUiText(getAgendaEntryTitle(item.entry))}
						</Text>
					</View>
				</View>
			</View>
		</TouchableOpacity>
	);
}

function NextLearningStepCard({
	item,
	isLoading,
	todayKey,
	onOpenItem,
	onOpenLearningPlans,
}: {
	item: DashboardAgendaItem | undefined;
	isLoading: boolean;
	todayKey: string;
	onOpenItem: (item: DashboardAgendaItem) => void;
	onOpenLearningPlans: () => void;
}) {
	const { colors } = useDayovaTheme();
	const title = isLoading
		? "Wird geladen …"
		: item
			? formatGermanUiText(getAgendaEntryTitle(item.entry))
			: "Noch nichts geplant";
	const dateLabel = item ? getNextStepDateLabel(item, todayKey) : null;
	const timeLabel = item ? getNextStepTimeLabel(item) : null;
	const footer = isLoading
		? "Lernplan öffnen"
		: item
			? getNextStepFooter(item, todayKey)
			: "Lernplan öffnen";
	const handlePress = () => {
		if (item) {
			onOpenItem(item);
			return;
		}
		onOpenLearningPlans();
	};

	return (
		<TouchableOpacity
			activeOpacity={0.82}
			accessibilityRole="button"
			accessibilityLabel={
				item
					? `${item.entry.executionStatus === "started" ? "Weiterlernen" : "Nächsten Lernschritt öffnen"}: ${title}. ${dateLabel}, ${timeLabel}`
					: "Lernpläne öffnen"
			}
			accessibilityHint="Öffnet deinen persönlichen Lernplan."
			onPress={handlePress}
			className="min-h-72 flex-1 overflow-hidden rounded-card border border-border bg-system-subtle px-4 pt-5 pb-4"
			style={continuousBorderStyle}
		>
			<View className="flex-row items-start gap-1">
				<Dumbbell size={14} color={colors.primaryStrong} strokeWidth={2} />
				<Text
					className="flex-1 font-poppins font-semibold text-body-5 text-primary-strong"
					numberOfLines={2}
				>
					Nächster Lernschritt
				</Text>
			</View>
			<Text
				className="mt-4 font-poppins font-semibold text-body-1 text-text"
				numberOfLines={3}
			>
				{title}
			</Text>
			<View className="mt-3 flex-1 gap-2">
				{dateLabel ? (
					<View className="flex-row items-center gap-2">
						<CalendarDays
							size={16}
							color={colors.secondaryText}
							strokeWidth={1.9}
						/>
						<Text
							className="flex-1 font-poppins text-body-5 text-secondary-text"
							numberOfLines={1}
						>
							{dateLabel}
						</Text>
					</View>
				) : null}
				{timeLabel ? (
					<View className="flex-row items-center gap-2">
						<Clock3 size={16} color={colors.secondaryText} strokeWidth={1.9} />
						<Text
							className="flex-1 font-poppins text-body-5 text-secondary-text"
							numberOfLines={1}
							style={tabularNumberStyle}
						>
							{timeLabel}
						</Text>
					</View>
				) : null}
			</View>
			<View className="mt-4 flex-row items-end justify-between gap-2">
				<Text
					className="flex-1 pr-1 font-poppins font-semibold text-body-4 text-text"
					numberOfLines={2}
				>
					{footer}
				</Text>
				<View
					accessible={false}
					className="h-12 w-12 items-center justify-center rounded-full bg-primary"
				>
					<ArrowRight
						size={22}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2}
					/>
				</View>
			</View>
		</TouchableOpacity>
	);
}

function WeeklyProgressCard({
	isLoading,
	progress,
	onOpenLearningPlans,
}: {
	isLoading: boolean;
	progress: DashboardWeekProgress;
	onOpenLearningPlans: () => void;
}) {
	const { colors } = useDayovaTheme();
	const hasPlannedSessions = progress.totalLearningSessions > 0;
	const ringValue = isLoading
		? "–"
		: hasPlannedSessions
			? `${progress.completedLearningSessions} / ${progress.totalLearningSessions}`
			: "0";
	const ringLabel = isLoading
		? "wird geladen"
		: hasPlannedSessions
			? "geschafft"
			: "geplant";
	const progressOffset =
		WEEK_PROGRESS_RING_CIRCUMFERENCE *
		(1 - (isLoading ? 0 : progress.completionPercent) / 100);
	const footer = getDashboardWeekProgressFooter({ isLoading, progress });

	return (
		<TouchableOpacity
			activeOpacity={0.82}
			accessibilityRole="button"
			accessibilityLabel={
				isLoading
					? "Wochenfortschritt wird geladen"
					: hasPlannedSessions
						? `Wochenfortschritt: ${progress.completedLearningSessions} von ${progress.totalLearningSessions} Lernschritten geschafft. ${footer}.`
						: "Wochenfortschritt: Noch keine Lernschritte geplant"
			}
			accessibilityHint="Öffnet deine persönlichen Lernpläne."
			onPress={onOpenLearningPlans}
			className="min-h-72 flex-1 overflow-hidden rounded-card border border-border bg-ueben-subtle px-4 pt-5 pb-4"
			style={continuousBorderStyle}
		>
			<View className="flex-row items-start gap-1">
				<TimeManagement size={14} color={colors.ueben} strokeWidth={2} />
				<Text
					className="flex-1 font-poppins font-semibold text-body-5 text-ueben"
					numberOfLines={2}
				>
					Wochenfortschritt
				</Text>
			</View>
			<View className="flex-1 items-center justify-center py-2">
				<View
					accessible={false}
					className="items-center justify-center"
					// SVG ring geometry uses fixed native dimensions.
					style={{
						width: WEEK_PROGRESS_RING_SIZE,
						height: WEEK_PROGRESS_RING_SIZE,
					}}
				>
					<Svg
						pointerEvents="none"
						width={WEEK_PROGRESS_RING_SIZE}
						height={WEEK_PROGRESS_RING_SIZE}
						viewBox={`0 0 ${WEEK_PROGRESS_RING_SIZE} ${WEEK_PROGRESS_RING_SIZE}`}
						// SVG positioning is not expressible through NativeWind classes.
						style={{ position: "absolute" }}
					>
						<Circle
							cx={WEEK_PROGRESS_RING_SIZE / 2}
							cy={WEEK_PROGRESS_RING_SIZE / 2}
							r={WEEK_PROGRESS_RING_RADIUS}
							fill="none"
							stroke={colors.ueben}
							strokeOpacity={0.24}
							strokeWidth={WEEK_PROGRESS_RING_STROKE_WIDTH}
						/>
						<Circle
							cx={WEEK_PROGRESS_RING_SIZE / 2}
							cy={WEEK_PROGRESS_RING_SIZE / 2}
							r={WEEK_PROGRESS_RING_RADIUS}
							fill="none"
							stroke={colors.ueben}
							strokeDasharray={`${WEEK_PROGRESS_RING_CIRCUMFERENCE} ${WEEK_PROGRESS_RING_CIRCUMFERENCE}`}
							strokeDashoffset={progressOffset}
							strokeLinecap="round"
							strokeWidth={WEEK_PROGRESS_RING_STROKE_WIDTH}
							transform={`rotate(-90 ${WEEK_PROGRESS_RING_SIZE / 2} ${WEEK_PROGRESS_RING_SIZE / 2})`}
						/>
					</Svg>
					<Text
						className="font-poppins font-semibold text-body-1 text-text"
						numberOfLines={1}
						style={tabularNumberStyle}
					>
						{ringValue}
					</Text>
					<Text
						className="font-poppins text-body-5 text-secondary-text"
						numberOfLines={1}
					>
						{ringLabel}
					</Text>
				</View>
			</View>
			<View className="mt-4 flex-row items-end justify-between gap-2">
				<View className="flex-1 pr-1">
					<Text
						className="flex-1 font-poppins font-semibold text-body-4 text-text"
						numberOfLines={2}
						style={tabularNumberStyle}
					>
						{footer}
					</Text>
				</View>
				<View
					accessible={false}
					className="h-12 w-12 items-center justify-center rounded-full bg-secondary"
				>
					<ArrowRight
						size={22}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2}
					/>
				</View>
			</View>
		</TouchableOpacity>
	);
}

function SupportingEntryCard({
	item,
	isPast,
	onPress,
}: {
	item: DashboardAgendaItem;
	isPast: boolean;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	const isExam = item.kind === "exam";
	const Icon = isExam ? Backpack : Check;
	const accentColor = isExam
		? DAYOVA_DESIGN_SYSTEM.colors.wrong
		: DAYOVA_DESIGN_SYSTEM.colors.hausaufgabe;

	return (
		<TouchableOpacity
			activeOpacity={0.86}
			accessibilityRole="button"
			accessibilityLabel={`${isExam ? "Prüfung" : "Aufgabe"}: ${formatGermanUiText(getAgendaEntryTitle(item.entry))}`}
			onPress={onPress}
			className={cn(
				"min-h-24 flex-row items-center rounded-3xl border border-border bg-card px-4 py-4",
				isPast && "opacity-55",
			)}
			style={continuousBorderStyle}
		>
			<View
				className={cn(
					"h-10 w-10 items-center justify-center rounded-full",
					isExam ? "bg-wrong-subtle" : "bg-hausaufgabe-subtle",
				)}
			>
				<Icon size={19} color={accentColor} strokeWidth={2} />
			</View>
			<View className="ml-3 flex-1">
				<Text
					className={cn(
						"font-poppins font-semibold text-body-5",
						isExam ? "text-wrong" : "text-hausaufgabe",
					)}
				>
					{isExam ? "Prüfung" : "Aufgabe"}
				</Text>
				<Text
					className="font-poppins font-semibold text-body-3 text-text"
					numberOfLines={1}
				>
					{formatGermanUiText(getAgendaEntryTitle(item.entry))}
				</Text>
				<Text
					className="font-poppins text-body-4 text-secondary-text"
					numberOfLines={1}
				>
					{getEntrySummary(item.entry)}
				</Text>
			</View>
			<ArrowUpRight size={18} color={colors.secondaryText} strokeWidth={1.9} />
		</TouchableOpacity>
	);
}

function AgendaItemRow({
	item,
	isFirst,
	isLast,
	isPast,
	isPrimary,
	onPress,
}: {
	item: DashboardAgendaItem;
	isFirst: boolean;
	isLast: boolean;
	isPast: boolean;
	isPrimary: boolean;
	onPress: () => void;
}) {
	return (
		<View className="flex-row">
			<View className="w-12 pt-2 pr-1">
				<Text
					className={cn(
						"text-right font-poppins text-body-5",
						isPast ? "text-secondary-text/55" : "text-secondary-text",
					)}
					style={tabularNumberStyle}
				>
					{item.startMinutes === null
						? "ganztägig"
						: formatMinutes(item.startMinutes)}
				</Text>
			</View>
			<TimelineRail
				isFirst={isFirst}
				isLast={isLast}
				isPast={isPast}
				isPrimary={isPrimary}
			/>
			<View className="flex-1 pb-5 pl-1">
				{item.kind === "schoolLesson" ? (
					<SchoolLessonCard item={item} isPast={isPast} />
				) : item.kind === "learningSession" ? (
					<LearningSessionCard item={item} isPast={isPast} onPress={onPress} />
				) : (
					<SupportingEntryCard item={item} isPast={isPast} onPress={onPress} />
				)}
			</View>
		</View>
	);
}

function EmptyAgendaDay() {
	return (
		<View
			className="items-center rounded-card border border-border bg-card px-6 py-10"
			style={continuousBorderStyle}
		>
			<View className="h-14 w-14 items-center justify-center rounded-full bg-system-subtle">
				<CalendarDays
					size={24}
					color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
					strokeWidth={1.9}
				/>
			</View>
			<Text className="mt-5 font-poppins font-semibold text-body-1 text-text">
				Noch nichts geplant
			</Text>
			<Text className="mt-1 max-w-64 text-center font-poppins text-body-4 text-secondary-text">
				Für diesen Tag sind noch keine Termine geplant.
			</Text>
		</View>
	);
}

function TimetableSetupCard({
	hasDraft,
	onPress,
}: {
	hasDraft: boolean;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();

	return (
		<TouchableOpacity
			activeOpacity={0.84}
			accessibilityRole="button"
			accessibilityLabel={
				hasDraft ? "Stundenplan-Import fortsetzen" : "Stundenplan hinzufügen"
			}
			accessibilityHint="Öffnet den Stundenplan zum Hochladen und Prüfen."
			onPress={onPress}
			className="mx-6 mb-5 flex-row items-center rounded-card border border-border bg-card px-5 py-4"
			style={continuousBorderStyle}
		>
			<View className="h-12 w-12 items-center justify-center rounded-full bg-system-subtle">
				<ScanImage size={22} color={colors.primaryStrong} strokeWidth={2} />
			</View>
			<View className="ml-4 flex-1">
				<Text className="font-poppins font-semibold text-body-3 text-text">
					{hasDraft ? "Stundenplan fertigstellen" : "Stundenplan hinzufügen"}
				</Text>
				<Text className="mt-1 font-poppins text-body-5 text-secondary-text">
					{hasDraft
						? "Prüfe die erkannten Schulstunden."
						: "Schulstunden in deinen Tag übernehmen."}
				</Text>
			</View>
			<ArrowRight size={19} color={colors.secondaryText} strokeWidth={2} />
		</TouchableOpacity>
	);
}

function AgendaTimeline({
	days,
	todayKey,
	currentMinutes,
	nextActionableId,
	onOpenItem,
}: {
	days: AgendaDay[];
	todayKey: string;
	currentMinutes: number;
	nextActionableId: DayEntry["id"] | undefined;
	onOpenItem: (item: DashboardAgendaItem) => void;
}) {
	return (
		<View>
			{days.map((day) => (
				<View key={day.key}>
					{day.items.length === 0 ? (
						<EmptyAgendaDay />
					) : (
						day.items.map((item, itemIndex) => {
							const isPast = isDashboardAgendaItemPast({
								item,
								todayKey,
								currentMinutes,
							});
							return (
								<AgendaItemRow
									key={`${day.key}-${item.entry.id}`}
									item={item}
									isFirst={itemIndex === 0}
									isLast={itemIndex === day.items.length - 1}
									isPast={isPast}
									isPrimary={item.entry.id === nextActionableId}
									onPress={() => onOpenItem(item)}
								/>
							);
						})
					)}
				</View>
			))}
		</View>
	);
}

function AgendaDayPage({
	dayKey,
	todayKey,
	entries,
	isLoading,
	currentMinutes,
	nextActionableId,
	onOpenItem,
}: {
	dayKey: string;
	todayKey: string;
	entries: DayEntry[] | undefined;
	isLoading: boolean;
	currentMinutes: number;
	nextActionableId: DayEntry["id"] | undefined;
	onOpenItem: (item: DashboardAgendaItem) => void;
}) {
	const calendarDay = toCalendarDay({ dayKey, todayKey });
	const agendaDay = calendarDay
		? {
				...calendarDay,
				items: sortDashboardAgendaItems(
					(entries ?? []).map((entry) => toDashboardAgendaItem(dayKey, entry)),
				),
			}
		: null;

	return (
		<View className="px-6 pt-6">
			{isLoading || !agendaDay ? (
				<View
					accessibilityRole="progressbar"
					className="items-center rounded-card border-border border-hairline bg-card px-6 py-10"
					style={continuousBorderStyle}
				>
					<Text className="font-poppins text-body-3 text-secondary-text">
						Dein Tag wird geladen …
					</Text>
				</View>
			) : (
				<AgendaTimeline
					days={[agendaDay]}
					todayKey={todayKey}
					currentMinutes={currentMinutes}
					nextActionableId={nextActionableId}
					onOpenItem={onOpenItem}
				/>
			)}
		</View>
	);
}

export function DashboardScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ dayKey?: string }>();
	const insets = useSafeAreaInsets();
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const todayKey = getDayKey(today);
	const requestedDay = parseDayKey(params.dayKey);
	const initialDayKey = requestedDay ? getDayKey(requestedDay) : todayKey;
	const [dayPagerKeys] = useState(() =>
		getDashboardCalendarDayKeys({
			anchorDayKey: initialDayKey,
		}),
	);
	const [selectedDayKey, setSelectedDayKey] = useState(initialDayKey);
	const [now, setNow] = useState(() => new Date());
	const selectedDate = parseDayKey(selectedDayKey) ?? today;

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(timer);
	}, []);

	const selectedPagerIndex = Math.max(dayPagerKeys.indexOf(selectedDayKey), 0);
	const calendarDays = getDashboardWeekDayKeys(selectedDayKey).flatMap(
		(dayKey) => {
			const day = toCalendarDay({ dayKey, todayKey });
			return day ? [day] : [];
		},
	);
	const queriedDayKeys = getDashboardRelevantDayKeys({
		selectedDayKey,
		todayKey,
	});
	const entriesByDay = useQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated ? { dayKeys: queriedDayKeys } : "skip",
	);
	const timetableState = useQuery(
		api.timetables.getMine,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const allRelevantAgendaItems = entriesByDay
		? queriedDayKeys.flatMap((dayKey) =>
				(entriesByDay[dayKey] ?? []).map((entry) =>
					toDashboardAgendaItem(dayKey, entry),
				),
			)
		: [];
	const currentMinutes = now.getHours() * 60 + now.getMinutes();
	const nextLearningStep = findNextActionableAgendaItem({
		items: allRelevantAgendaItems,
		todayKey,
		currentMinutes,
	});
	const weekProgress = getDashboardWeekProgress({
		items: allRelevantAgendaItems,
		todayKey,
	});
	const nextActionableId = nextLearningStep?.entry.id;
	const selectedWeekday = formatGermanUiText(
		new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(selectedDate),
	);
	const selectedDayEntryCount = entriesByDay?.[selectedDayKey]?.length ?? 0;
	const selectedDayAgendaLabel =
		entriesByDay === undefined
			? "Dein Tag wird geladen …"
			: `${selectedDayKey === todayKey ? "Heute geplant" : "Geplant"} · ${selectedDayEntryCount} ${
					selectedDayEntryCount === 1 ? "Termin" : "Termine"
				}`;
	const firstName =
		typeof user?.name === "string" && user.name.trim().length > 0
			? user.name.trim().split(/\s+/)[0]
			: null;

	const commitSelectedDay = useCallback(
		(dayKey: string) => {
			const date = parseDayKey(dayKey);
			if (!date || dayKey === selectedDayKey) return;
			setSelectedDayKey(dayKey);
		},
		[selectedDayKey],
	);

	const selectDay = (day: CalendarDay) => {
		if (!dayPagerKeys.includes(day.key)) return;
		commitSelectedDay(day.key);
	};

	const adjustSelectedDay = useCallback(
		(direction: -1 | 1) => {
			const nextIndex = Math.min(
				Math.max(selectedPagerIndex + direction, 0),
				dayPagerKeys.length - 1,
			);
			const nextDayKey = dayPagerKeys[nextIndex];
			if (!nextDayKey) return;
			commitSelectedDay(nextDayKey);
			triggerDaySelectionHaptic();
		},
		[commitSelectedDay, dayPagerKeys, selectedPagerIndex],
	);

	const daySwipeGesture = useMemo(
		() =>
			Gesture.Pan()
				.activeOffsetX([-24, 24])
				.failOffsetY([-12, 12])
				.onEnd((event) => {
					"worklet";
					const passedDistance = Math.abs(event.translationX) >= 56;
					const passedVelocity = Math.abs(event.velocityX) >= 650;
					if (!passedDistance && !passedVelocity) return;
					scheduleOnRN(adjustSelectedDay, event.translationX < 0 ? 1 : -1);
				}),
		[adjustSelectedDay],
	);

	const openItem = useCallback(
		(item: DashboardAgendaItem) => {
			if (item.kind === "schoolLesson") return;
			const itemDate = parseDayKey(item.dayKey) ?? selectedDate;
			const itemDayLabel = new Intl.DateTimeFormat("de-DE", {
				weekday: "long",
				day: "numeric",
				month: "long",
			}).format(itemDate);
			router.push(getEntryUrl(item.entry, itemDayLabel));
		},
		[router, selectedDate],
	);

	const openLearningPlans = useCallback(
		() => router.push("/learning-plans"),
		[router],
	);
	const openTimetable = useCallback(() => router.push("/timetable"), [router]);

	return (
		<View className="flex-1 bg-background">
			<ThemedStatusBar />
			<View
				className="bg-background px-6"
				// Safe-area padding is runtime device geometry.
				style={{ paddingTop: insets.top + 16 }}
			>
				<View className="flex-row items-center justify-between">
					<View className="flex-1 pr-4">
						<Text className="font-poppins text-body-4 text-secondary-text">
							{getMonthHeading(selectedDate)}
						</Text>
						<Text
							accessibilityRole="header"
							className="font-poppins font-semibold text-heading-2 text-text"
							numberOfLines={1}
						>
							{firstName ? `Hallo ${firstName}` : "Dein Tag"}
						</Text>
					</View>
					<NotificationButton />
				</View>

				<View className="mt-10">
					<WeekCalendar
						days={calendarDays}
						selectedDayKey={selectedDayKey}
						onSelectDay={selectDay}
					/>
				</View>
			</View>

			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="never"
				directionalLockEnabled
				nestedScrollEnabled
				showsVerticalScrollIndicator={false}
				stickyHeaderIndices={[2]}
				// Native tabs own the screen edge; this keeps the final item comfortably clear.
				contentContainerStyle={{
					paddingBottom: Math.max(insets.bottom + 72, 104),
				}}
			>
				<View className="flex-row gap-3 px-6 pt-10 pb-5">
					<NextLearningStepCard
						item={nextLearningStep}
						isLoading={entriesByDay === undefined}
						todayKey={todayKey}
						onOpenItem={openItem}
						onOpenLearningPlans={openLearningPlans}
					/>
					<WeeklyProgressCard
						isLoading={entriesByDay === undefined}
						progress={weekProgress}
						onOpenLearningPlans={openLearningPlans}
					/>
				</View>

				<View>
					{timetableState !== undefined && !timetableState.active ? (
						<TimetableSetupCard
							hasDraft={Boolean(timetableState.draft)}
							onPress={openTimetable}
						/>
					) : null}
				</View>

				<View className="z-10 bg-background px-6 pt-5 pb-6">
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-heading-2 text-text"
					>
						{selectedWeekday}
					</Text>
					<Text className="font-poppins text-body-4 text-secondary-text">
						{selectedDayAgendaLabel}
					</Text>
				</View>

				<GestureDetector gesture={daySwipeGesture}>
					<View
						accessible
						accessibilityActions={[
							{ name: "increment", label: "Nächsten Tag anzeigen" },
							{ name: "decrement", label: "Vorherigen Tag anzeigen" },
						]}
						accessibilityLabel={`Tagesagenda für ${selectedWeekday}`}
						accessibilityRole="adjustable"
						onAccessibilityAction={({ nativeEvent }) => {
							if (nativeEvent.actionName === "increment") adjustSelectedDay(1);
							if (nativeEvent.actionName === "decrement") adjustSelectedDay(-1);
						}}
					>
						<AgendaDayPage
							dayKey={selectedDayKey}
							todayKey={todayKey}
							entries={entriesByDay?.[selectedDayKey]}
							isLoading={entriesByDay === undefined}
							currentMinutes={currentMinutes}
							nextActionableId={nextActionableId}
							onOpenItem={openItem}
						/>
					</View>
				</GestureDetector>
			</ScrollView>
		</View>
	);
}
