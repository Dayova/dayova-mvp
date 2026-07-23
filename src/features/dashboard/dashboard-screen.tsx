import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type FlatList,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	ScrollView,
	StyleSheet,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import { CreateTypePickerModal } from "~/components/create-type-picker-modal";
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
	Plus,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { useValidationAnalytics } from "~/lib/analytics";
import { getDayKey, parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { triggerSelectionHaptic } from "~/lib/safe-haptics";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import type { DayEntry } from "~/types/dayEntries";
import {
	type DashboardAgendaItem,
	findNextActionableAgendaItem,
	getAgendaEntryTitle,
	getDashboardCalendarDayKeys,
	getDashboardRelevantDayKeys,
	getDashboardWeekDayKeys,
	isDashboardAgendaItemPast,
	sortDashboardAgendaItems,
	toDashboardAgendaItem,
} from "./dashboard-agenda";

const PRIMARY_INTERACTIVE_GRADIENT =
	DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;

const triggerDaySelectionHaptic = () => {
	void triggerSelectionHaptic({
		platform: process.env.EXPO_OS,
		selectionAsync: () => Haptics.selectionAsync(),
	});
};

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

const getNextStepWhenLabel = (item: DashboardAgendaItem, todayKey: string) => {
	const date = parseDayKey(item.dayKey);
	if (!date) return getTimeLabel(item);
	const dayLabel =
		item.dayKey === todayKey
			? "Heute"
			: formatGermanUiText(
					new Intl.DateTimeFormat("de-DE", {
						weekday: "short",
						day: "numeric",
						month: "short",
					}).format(date),
				);
	return `${dayLabel} · ${getTimeLabel(item)}`;
};

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
		<View className="flex-row gap-1">
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
						className={cn(
							"h-16 flex-1 items-center justify-center rounded-3xl border-hairline",
							selected
								? "border-button-neutral bg-button-neutral"
								: "border-transparent bg-transparent",
						)}
						style={{ borderCurve: "continuous" }}
					>
						<Text
							className={cn(
								"font-poppins text-body-5",
								selected ? "text-background/70" : "text-secondary-text",
							)}
						>
							{day.weekday}
						</Text>
						<Text
							className={cn(
								"font-poppins font-semibold text-body-3",
								selected ? "text-background" : "text-text",
							)}
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{day.dayOfMonth}
						</Text>
						{day.isToday && !selected ? (
							<View className="mt-1 h-1 w-1 rounded-full bg-primary" />
						) : (
							<View className="mt-1 h-1 w-1" />
						)}
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
				"min-h-20 flex-row items-center rounded-3xl border-border border-hairline bg-light-2 px-4 py-3",
				isPast && "opacity-55",
			)}
			style={{ borderCurve: "continuous" }}
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
	isPrimary,
	onPress,
}: {
	item: DashboardAgendaItem;
	isPast: boolean;
	isPrimary: boolean;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	const isStarted = item.entry.executionStatus === "started";

	return (
		<TouchableOpacity
			activeOpacity={0.86}
			accessibilityRole="button"
			accessibilityLabel={`${isStarted ? "Weiterlernen" : "Lernsession starten"}: ${formatGermanUiText(getAgendaEntryTitle(item.entry))}`}
			onPress={onPress}
			className={cn(
				"min-h-28 overflow-hidden rounded-card border-hairline bg-card",
				isPrimary ? "border-primary/30" : "border-border",
				isPast && "opacity-55",
			)}
			style={{
				borderCurve: "continuous",
				boxShadow: "0 6px 16px rgba(21, 29, 48, 0.05)",
			}}
		>
			{isPrimary ? (
				<LinearGradient
					pointerEvents="none"
					colors={PRIMARY_INTERACTIVE_GRADIENT.colors}
					start={PRIMARY_INTERACTIVE_GRADIENT.start}
					end={PRIMARY_INTERACTIVE_GRADIENT.end}
					style={styles.primaryCardAccent}
				/>
			) : (
				<View className="absolute top-0 bottom-0 left-0 w-1 bg-ueben" />
			)}
			<View className="min-h-28 justify-center px-5 py-4">
				<View className="flex-row items-center">
					<View
						className={cn(
							"h-10 w-10 items-center justify-center rounded-full",
							isPrimary ? "bg-system-subtle" : "bg-ueben-subtle",
						)}
					>
						<Dumbbell
							size={19}
							color={
								isPrimary
									? DAYOVA_DESIGN_SYSTEM.colors.primaryStrong
									: DAYOVA_DESIGN_SYSTEM.colors.ueben
							}
							strokeWidth={2}
						/>
					</View>
					<View className="ml-3 flex-1">
						<Text
							className={cn(
								"font-poppins font-semibold text-body-5",
								isPrimary ? "text-primary-strong" : "text-ueben",
							)}
						>
							Dein Lernschritt
						</Text>
						<Text
							className="font-poppins font-semibold text-body-2 text-text"
							numberOfLines={2}
						>
							{formatGermanUiText(getAgendaEntryTitle(item.entry))}
						</Text>
					</View>
					{!isPast ? (
						<ArrowRight
							size={18}
							color={isPrimary ? colors.primaryStrong : colors.secondaryText}
							strokeWidth={2}
						/>
					) : null}
				</View>
				{!isPast ? (
					<View className="mt-3 flex-row items-center">
						<View className="flex-row items-center">
							<Clock3
								size={16}
								color={colors.secondaryText}
								strokeWidth={1.9}
							/>
							<Text className="ml-2 font-poppins text-body-4 text-secondary-text">
								{item.entry.durationMinutes
									? `${item.entry.durationMinutes} Min.`
									: "45 Min."}
							</Text>
						</View>
					</View>
				) : null}
			</View>
		</TouchableOpacity>
	);
}

function NextLearningStepPanel({
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

	if (isLoading) {
		return (
			<View
				accessibilityRole="progressbar"
				className="min-h-24 justify-center rounded-card border-border border-hairline bg-card px-5 py-4"
				style={{ borderCurve: "continuous" }}
			>
				<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
					Nächster Lernschritt
				</Text>
				<Text className="mt-1 font-poppins text-body-3 text-secondary-text">
					Dein Lernplan wird geprüft …
				</Text>
			</View>
		);
	}

	if (!item) {
		return (
			<TouchableOpacity
				activeOpacity={0.86}
				accessibilityRole="button"
				accessibilityLabel="Lernpläne öffnen"
				onPress={onOpenLearningPlans}
				className="min-h-24 flex-row items-center rounded-card border-border border-hairline bg-card px-5 py-4"
				style={{ borderCurve: "continuous" }}
			>
				<View className="h-11 w-11 items-center justify-center rounded-full bg-system-subtle">
					<Dumbbell
						size={20}
						color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
						strokeWidth={2}
					/>
				</View>
				<View className="ml-3 flex-1">
					<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
						Nächster Lernschritt
					</Text>
					<Text className="font-poppins font-semibold text-body-3 text-text">
						Noch kein Lernschritt geplant
					</Text>
					<Text className="font-poppins text-body-5 text-secondary-text">
						Öffne deine Lernpläne und plane den nächsten Schritt.
					</Text>
				</View>
				<ArrowUpRight size={19} color={colors.primaryStrong} strokeWidth={2} />
			</TouchableOpacity>
		);
	}

	return (
		<TouchableOpacity
			activeOpacity={0.86}
			accessibilityRole="button"
			accessibilityLabel={`${item.entry.executionStatus === "started" ? "Weiterlernen" : "Nächsten Lernschritt starten"}: ${formatGermanUiText(getAgendaEntryTitle(item.entry))}`}
			onPress={() => onOpenItem(item)}
			className="min-h-28 overflow-hidden rounded-card border-hairline border-primary/30 bg-card px-5 py-4"
			style={{
				borderCurve: "continuous",
				boxShadow: "0 12px 28px rgba(0, 160, 230, 0.12)",
			}}
		>
			<LinearGradient
				pointerEvents="none"
				colors={PRIMARY_INTERACTIVE_GRADIENT.colors}
				start={PRIMARY_INTERACTIVE_GRADIENT.start}
				end={PRIMARY_INTERACTIVE_GRADIENT.end}
				style={styles.primaryCardAccent}
			/>
			<View className="flex-row items-start">
				<View className="h-11 w-11 items-center justify-center rounded-full bg-system-subtle">
					<Dumbbell
						size={20}
						color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
						strokeWidth={2}
					/>
				</View>
				<View className="ml-3 flex-1">
					<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
						Nächster Lernschritt
					</Text>
					<Text
						className="font-poppins font-semibold text-body-2 text-text"
						numberOfLines={2}
					>
						{formatGermanUiText(getAgendaEntryTitle(item.entry))}
					</Text>
					<Text
						className="mt-1 font-poppins text-body-5 text-secondary-text"
						numberOfLines={1}
					>
						{getNextStepWhenLabel(item, todayKey)}
						{item.entry.durationMinutes
							? ` · ${item.entry.durationMinutes} Min.`
							: ""}
					</Text>
				</View>
				<View className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-system-subtle">
					<ArrowRight
						size={18}
						color={colors.primaryStrong}
						strokeWidth={2.2}
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
				"min-h-24 flex-row items-center rounded-3xl border-border border-hairline bg-card px-4 py-4",
				isPast && "opacity-55",
			)}
			style={{
				borderCurve: "continuous",
				boxShadow: "0 6px 16px rgba(21, 29, 48, 0.05)",
			}}
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
					style={{ fontVariant: ["tabular-nums"] }}
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
					<LearningSessionCard
						item={item}
						isPast={isPast}
						isPrimary={isPrimary}
						onPress={onPress}
					/>
				) : (
					<SupportingEntryCard item={item} isPast={isPast} onPress={onPress} />
				)}
			</View>
		</View>
	);
}

function EmptyAgendaDay({ onCreateEntry }: { onCreateEntry: () => void }) {
	const { colors } = useDayovaTheme();
	return (
		<View
			className="items-center rounded-card bg-light-2 px-6 py-10"
			style={{ borderCurve: "continuous" }}
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
				Füge eine Aufgabe oder Prüfung für diesen Tag hinzu.
			</Text>
			<TouchableOpacity
				activeOpacity={0.84}
				accessibilityRole="button"
				accessibilityLabel="Eintrag für diesen Tag hinzufügen"
				onPress={onCreateEntry}
				className="mt-6 h-12 flex-row items-center justify-center rounded-full bg-system-subtle px-5"
			>
				<Plus size={18} color={colors.primaryStrong} strokeWidth={2} />
				<Text className="ml-2 font-poppins font-semibold text-body-4 text-primary-strong">
					Eintrag hinzufügen
				</Text>
			</TouchableOpacity>
		</View>
	);
}

function AgendaTimeline({
	days,
	todayKey,
	currentMinutes,
	nextActionableId,
	onOpenItem,
	onCreateEntry,
}: {
	days: AgendaDay[];
	todayKey: string;
	currentMinutes: number;
	nextActionableId: DayEntry["id"] | undefined;
	onOpenItem: (item: DashboardAgendaItem) => void;
	onCreateEntry: () => void;
}) {
	return (
		<View>
			{days.map((day) => (
				<View key={day.key}>
					{day.items.length === 0 ? (
						<EmptyAgendaDay onCreateEntry={onCreateEntry} />
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
	pageWidth,
	bottomPadding,
	onOpenItem,
	onCreateEntry,
}: {
	dayKey: string;
	todayKey: string;
	entries: DayEntry[] | undefined;
	isLoading: boolean;
	currentMinutes: number;
	nextActionableId: DayEntry["id"] | undefined;
	pageWidth: number;
	bottomPadding: number;
	onOpenItem: (item: DashboardAgendaItem) => void;
	onCreateEntry: () => void;
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
		<View
			className="flex-1"
			// Each horizontal page follows the measured device width.
			style={{ width: pageWidth }}
		>
			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="never"
				directionalLockEnabled
				nestedScrollEnabled
				showsVerticalScrollIndicator={false}
				contentContainerClassName="px-6 pt-1"
				contentContainerStyle={{ paddingBottom: bottomPadding }}
			>
				{isLoading || !agendaDay ? (
					<View
						accessibilityRole="progressbar"
						className="items-center rounded-card border-border border-hairline bg-card px-6 py-10"
						style={{ borderCurve: "continuous" }}
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
						onCreateEntry={onCreateEntry}
					/>
				)}
			</ScrollView>
		</View>
	);
}

export function DashboardScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ dayKey?: string }>();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const reduceMotion = useReducedMotion();
	const { colors } = useDayovaTheme();
	const { user } = useAuth();
	const { capture } = useValidationAnalytics();
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
	const [showCreateTypePicker, setShowCreateTypePicker] = useState(false);
	const didCaptureDashboardViewRef = useRef(false);
	const dayPagerRef = useRef<FlatList<string>>(null);
	const pageWidth = Math.max(width, 1);
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
	const queriedDayKeySet = new Set(queriedDayKeys);
	const entriesByDay = useQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated ? { dayKeys: queriedDayKeys } : "skip",
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
	const nextActionableId = nextLearningStep?.entry.id;
	const selectedDayLabel = new Intl.DateTimeFormat("de-DE", {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(selectedDate);
	const selectedWeekday = formatGermanUiText(
		new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(selectedDate),
	);
	const firstName =
		typeof user?.name === "string" && user.name.trim().length > 0
			? user.name.trim().split(/\s+/)[0]
			: null;
	useEffect(() => {
		if (didCaptureDashboardViewRef.current || entriesByDay === undefined)
			return;
		didCaptureDashboardViewRef.current = true;
		capture("dashboard_viewed", {
			selected_day_key: selectedDayKey,
			visible_days_count: calendarDays.length,
			selected_day_entries_count: entriesByDay[selectedDayKey]?.length ?? 0,
			has_hero_entry: Boolean(nextActionableId),
		});
	}, [
		calendarDays.length,
		capture,
		entriesByDay,
		nextActionableId,
		selectedDayKey,
	]);

	const commitSelectedDay = (dayKey: string, source: "day_strip" | "swipe") => {
		const date = parseDayKey(dayKey);
		if (!date || dayKey === selectedDayKey) return;
		setSelectedDayKey(dayKey);
		capture("dashboard_day_selected", {
			selected_day_key: dayKey,
			selected_day_offset: Math.round(
				(date.getTime() - today.getTime()) / 86_400_000,
			),
			source,
		});
	};

	const selectDay = (day: CalendarDay) => {
		const nextIndex = dayPagerKeys.indexOf(day.key);
		if (nextIndex < 0) return;
		commitSelectedDay(day.key, "day_strip");
		dayPagerRef.current?.scrollToOffset({
			offset: nextIndex * pageWidth,
			animated: !reduceMotion,
		});
	};

	const handleDayPagerSettled = (
		event: NativeSyntheticEvent<NativeScrollEvent>,
	) => {
		const nextIndex = Math.min(
			Math.max(Math.round(event.nativeEvent.contentOffset.x / pageWidth), 0),
			dayPagerKeys.length - 1,
		);
		const nextDayKey = dayPagerKeys[nextIndex];
		if (!nextDayKey || nextDayKey === selectedDayKey) return;

		commitSelectedDay(nextDayKey, "swipe");
		triggerDaySelectionHaptic();
	};

	const adjustSelectedDay = (direction: -1 | 1) => {
		const nextIndex = Math.min(
			Math.max(selectedPagerIndex + direction, 0),
			dayPagerKeys.length - 1,
		);
		const nextDayKey = dayPagerKeys[nextIndex];
		if (!nextDayKey) return;
		commitSelectedDay(nextDayKey, "swipe");
		dayPagerRef.current?.scrollToOffset({
			offset: nextIndex * pageWidth,
			animated: !reduceMotion,
		});
		triggerDaySelectionHaptic();
	};

	const openItem = useCallback(
		(item: DashboardAgendaItem, source: "timeline" | "next_step") => {
			if (item.kind === "schoolLesson") return;
			const itemDate = parseDayKey(item.dayKey) ?? selectedDate;
			const itemDayLabel = new Intl.DateTimeFormat("de-DE", {
				weekday: "long",
				day: "numeric",
				month: "long",
			}).format(itemDate);
			capture("dashboard_entry_opened", {
				entry_id: item.entry.id,
				entry_kind: item.kind,
				source,
				selected_day_key: item.dayKey,
				completed: Boolean(item.entry.completed),
			});
			router.push(getEntryUrl(item.entry, itemDayLabel));
		},
		[capture, router, selectedDate],
	);

	const openTimelineItem = useCallback(
		(item: DashboardAgendaItem) => openItem(item, "timeline"),
		[openItem],
	);

	const openNextLearningStep = useCallback(
		(item: DashboardAgendaItem) => openItem(item, "next_step"),
		[openItem],
	);

	const openLearningPlans = useCallback(
		() => router.push("/learning-plans"),
		[router],
	);

	const selectCreateType = (type: "homework" | "exam") => {
		setShowCreateTypePicker(false);
		capture("dashboard_create_type_selected", {
			entry_type: type,
			selected_day_key: selectedDayKey,
		});
		router.push(
			`/entry/new?type=${type}&dayKey=${encodeURIComponent(selectedDayKey)}&dayLabel=${encodeURIComponent(selectedDayLabel)}`,
		);
	};

	const openCreateEntryPicker = () => {
		capture("dashboard_create_opened", {
			selected_day_key: selectedDayKey,
		});
		setShowCreateTypePicker(true);
	};

	return (
		<View className="flex-1 bg-background">
			<ThemedStatusBar />
			<View className="flex-1">
				<View
					className="px-6"
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

					<View className="mt-6">
						<WeekCalendar
							days={calendarDays}
							selectedDayKey={selectedDayKey}
							onSelectDay={selectDay}
						/>
					</View>
				</View>

				<View className="px-6 pt-5">
					<NextLearningStepPanel
						item={nextLearningStep}
						isLoading={entriesByDay === undefined}
						todayKey={todayKey}
						onOpenItem={openNextLearningStep}
						onOpenLearningPlans={openLearningPlans}
					/>
				</View>

				<View className="flex-row items-center justify-between px-6 pt-5 pb-3">
					<Text className="font-poppins font-semibold text-heading-2 text-text">
						{selectedWeekday}
					</Text>
					<TouchableOpacity
						activeOpacity={0.86}
						accessibilityRole="button"
						accessibilityLabel="Neuen Eintrag erstellen"
						onPress={openCreateEntryPicker}
						className="h-11 w-11 items-center justify-center rounded-full border-border border-hairline bg-card"
						hitSlop={4}
						style={{ borderCurve: "continuous" }}
					>
						<Plus size={21} color={colors.primaryStrong} strokeWidth={2} />
					</TouchableOpacity>
				</View>

				<Animated.FlatList
					key={pageWidth}
					ref={dayPagerRef}
					data={dayPagerKeys}
					keyExtractor={(dayKey) => dayKey}
					horizontal
					pagingEnabled
					bounces={false}
					decelerationRate="fast"
					directionalLockEnabled
					disableIntervalMomentum
					initialScrollIndex={selectedPagerIndex}
					initialNumToRender={3}
					maxToRenderPerBatch={3}
					windowSize={3}
					nestedScrollEnabled
					showsHorizontalScrollIndicator={false}
					contentInsetAdjustmentBehavior="never"
					onMomentumScrollEnd={handleDayPagerSettled}
					getItemLayout={(_, index) => ({
						length: pageWidth,
						offset: pageWidth * index,
						index,
					})}
					accessibilityActions={[
						{ name: "increment", label: "Nächsten Tag anzeigen" },
						{ name: "decrement", label: "Vorherigen Tag anzeigen" },
					]}
					onAccessibilityAction={({ nativeEvent }) => {
						if (nativeEvent.actionName === "increment") adjustSelectedDay(1);
						if (nativeEvent.actionName === "decrement") adjustSelectedDay(-1);
					}}
					className="flex-1"
					renderItem={({ item: dayKey }) => (
						<AgendaDayPage
							dayKey={dayKey}
							todayKey={todayKey}
							entries={entriesByDay?.[dayKey]}
							isLoading={
								entriesByDay === undefined || !queriedDayKeySet.has(dayKey)
							}
							currentMinutes={currentMinutes}
							nextActionableId={nextActionableId}
							pageWidth={pageWidth}
							bottomPadding={Math.max(insets.bottom + 132, 156)}
							onOpenItem={openTimelineItem}
							onCreateEntry={openCreateEntryPicker}
						/>
					)}
				/>
			</View>

			<CreateTypePickerModal
				visible={showCreateTypePicker}
				onRequestClose={() => setShowCreateTypePicker(false)}
				onSelect={selectCreateType}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	primaryCardAccent: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: 0,
		width: 4,
	},
});
