import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	FlatList,
	ScrollView,
	type TextStyle,
	TouchableOpacity,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-screens/experimental";
import { scheduleOnRN } from "react-native-worklets";
import { api } from "#convex/_generated/api";
import { CreateEntryButton } from "~/components/create-entry-button";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import {
	addDays,
	getDayKey,
	parseDayKey,
	useCurrentLocalDay,
} from "~/lib/day-key";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { triggerSelectionHaptic } from "~/lib/safe-haptics";
import { useDayovaTheme } from "~/lib/theme";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";
import { cn } from "~/lib/utils";
import type { DayEntry } from "~/types/dayEntries";
import { getAgendaPlanRoute } from "./agenda-plan-route";
import { CompactDayAgenda } from "./compact-day-agenda";
import {
	type DashboardAgendaItem,
	findNextActionableAgendaItem,
	getAgendaEntryTitle,
	getDashboardCalendarDayKeys,
	getDashboardRelevantDayKeys,
	getDashboardWeekDayKeys,
	getVisibleDashboardEntries,
	sortDashboardAgendaItems,
	toDashboardAgendaItem,
} from "./dashboard-agenda";
import { DashboardCalendarHeader } from "./dashboard-calendar-header";
import { getDashboardNextStepFallbackAction } from "./dashboard-empty-state";
import { LearningRoutineCoach } from "./learning-routine-coach";
import { TodayLearningCard } from "./today-learning-card";

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
		<View className="flex-row border-border border-b pb-2">
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

export function DashboardScreen() {
	const { colors } = useDayovaTheme();
	const router = useRouter();
	const trackFeature = useFeatureAnalytics();
	const params = useLocalSearchParams<{ dayKey?: string }>();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const todayKey = getDayKey(today);
	const requestedDay = parseDayKey(params.dayKey);
	const initialDayKey = requestedDay ? getDayKey(requestedDay) : todayKey;
	const [dayPagerKeys, setDayPagerKeys] = useState(() =>
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
	const weekPageKeys = useMemo(
		() => [
			...new Set(
				dayPagerKeys.map(
					(dayKey) => getDashboardWeekDayKeys(dayKey)[0] ?? dayKey,
				),
			),
		],
		[dayPagerKeys],
	);
	const selectedWeekPageIndex = Math.max(
		weekPageKeys.findIndex((weekKey) =>
			getDashboardWeekDayKeys(weekKey).includes(selectedDayKey),
		),
		0,
	);
	const weekPagerWidth = Math.max(width - 48, 1);
	const weekPagerRef = useRef<FlatList<string>>(null);
	const visibleWeekPageIndexRef = useRef(selectedWeekPageIndex);
	const queriedDayKeys = getDashboardRelevantDayKeys({
		selectedDayKey,
		todayKey,
	});
	const queriedEntriesByDay = useQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated ? { dayKeys: queriedDayKeys } : "skip",
	);
	const entriesByDay =
		queriedEntriesByDay === undefined
			? undefined
			: Object.fromEntries(
					Object.entries(queriedEntriesByDay).map(([dayKey, entries]) => [
						dayKey,
						getVisibleDashboardEntries(entries),
					]),
				);
	const learningPlans = useQuery(
		api.learningPlans.listOverview,
		user && isConvexAuthenticated ? {} : "skip",
	);
	// Calendar browsing must not change the hero's candidates or loading state.
	const heroDayKeys = Array.from({ length: 31 }, (_, offset) =>
		getDayKey(addDays(today, offset)),
	);
	const heroEntries = useQuery(
		api.dayEntries.listByDayKeys,
		user && isConvexAuthenticated ? { dayKeys: heroDayKeys } : "skip",
	);
	const allRelevantAgendaItems = heroEntries
		? heroDayKeys.flatMap((dayKey) =>
				getVisibleDashboardEntries(heroEntries[dayKey] ?? []).map((entry) =>
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
	const nextStepFallbackAction = getDashboardNextStepFallbackAction({
		hasLearningPlans: Boolean(learningPlans?.length),
	});
	const firstName =
		typeof user?.name === "string" && user.name.trim().length > 0
			? user.name.trim().split(/\s+/)[0]
			: null;

	const commitSelectedDay = useCallback(
		(dayKey: string) => {
			const date = parseDayKey(dayKey);
			if (!date || dayKey === selectedDayKey) return;
			trackFeature("home.day_selected");
			setSelectedDayKey(dayKey);
		},
		[selectedDayKey, trackFeature],
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

	const selectWeekPage = useCallback(
		(nextPageIndex: number) => {
			const weekDelta = nextPageIndex - selectedWeekPageIndex;
			if (weekDelta === 0) return;
			const date = parseDayKey(selectedDayKey);
			if (!date) return;
			const nextDayKey = getDayKey(addDays(date, weekDelta * 7));
			if (!dayPagerKeys.includes(nextDayKey)) return;
			commitSelectedDay(nextDayKey);
			triggerDaySelectionHaptic();
		},
		[commitSelectedDay, dayPagerKeys, selectedDayKey, selectedWeekPageIndex],
	);

	useEffect(() => {
		if (visibleWeekPageIndexRef.current === selectedWeekPageIndex) return;
		visibleWeekPageIndexRef.current = selectedWeekPageIndex;
		weekPagerRef.current?.scrollToIndex({
			animated: true,
			index: selectedWeekPageIndex,
		});
	}, [selectedWeekPageIndex]);

	const openItem = useCallback(
		(item: DashboardAgendaItem, returnTo?: string) => {
			if (item.kind === "schoolLesson") return;
			trackFeature("home.entry_opened", "performed", item.entry.id);
			const itemDate = parseDayKey(item.dayKey) ?? parseDayKey(selectedDayKey);
			if (!itemDate) return;
			const itemDayLabel = new Intl.DateTimeFormat("de-DE", {
				weekday: "long",
				day: "numeric",
				month: "long",
			}).format(itemDate);
			router.push(
				withReturnTo(getEntryUrl(item.entry, itemDayLabel), returnTo),
			);
		},
		[router, selectedDayKey, trackFeature],
	);

	const openNextStepFallback = useCallback(
		() =>
			router.push(
				nextStepFallbackAction.route === ROUTES.createExam
					? withReturnTo(nextStepFallbackAction.route, ROUTES.home)
					: nextStepFallbackAction.route,
			),
		[nextStepFallbackAction.route, router],
	);

	return (
		<SafeAreaView
			// This native safe area includes the tab bar on both platforms.
			edges={{ bottom: true }}
			style={{ flex: 1, backgroundColor: colors.background }}
		>
			<ThemedStatusBar />
			<View
				className="bg-background px-6"
				// Safe-area padding is runtime device geometry.
				style={{ paddingTop: insets.top + 16 }}
			>
				<View className="flex-row items-center justify-between">
					<View className="flex-1 pr-4">
						<Text
							accessibilityRole="header"
							className="font-poppins font-semibold text-heading-2 text-text"
							numberOfLines={1}
						>
							{firstName ? `Hallo ${firstName}` : "Dein Tag"}
						</Text>
					</View>
					<CreateEntryButton returnTo={ROUTES.home} />
				</View>
			</View>
			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="never"
				directionalLockEnabled
				nestedScrollEnabled
				showsVerticalScrollIndicator={false}
				// The native safe area reserves the tab bar; padding adds breathing room.
				contentContainerClassName="pb-6"
			>
				<View className="px-6 pt-8 pb-6" testID="dashboard-next-step">
					<TodayLearningCard
						todayKey={todayKey}
						plan={learningPlans?.find(
							(plan) =>
								plan.id === nextLearningStep?.entry.relatedLearningPlanId,
						)}
						fallbackAction={nextStepFallbackAction}
						item={nextLearningStep}
						isLoading={heroEntries === undefined || learningPlans === undefined}
						onOpenFallback={openNextStepFallback}
						onOpenItem={(item) => openItem(item, ROUTES.home)}
					/>
					<View className="h-12" accessible={false} />
				</View>
				<LearningRoutineCoach referenceTime={now.getTime()} />
				<View className="px-6" testID="dashboard-calendar">
					<DashboardCalendarHeader
						selectedDate={selectedDate}
						onToday={() => {
							if (!dayPagerKeys.includes(todayKey)) {
								setDayPagerKeys(
									getDashboardCalendarDayKeys({ anchorDayKey: todayKey }),
								);
							}
							commitSelectedDay(todayKey);
						}}
					/>
					<FlatList
						ref={weekPagerRef}
						data={weekPageKeys}
						decelerationRate="fast"
						disableIntervalMomentum
						getItemLayout={(_data, index) => ({
							index,
							length: weekPagerWidth,
							offset: weekPagerWidth * index,
						})}
						horizontal
						initialNumToRender={3}
						initialScrollIndex={selectedWeekPageIndex}
						keyExtractor={(weekKey) => weekKey}
						maxToRenderPerBatch={3}
						onMomentumScrollEnd={(event) => {
							const nextPageIndex = Math.min(
								Math.max(
									Math.round(
										event.nativeEvent.contentOffset.x / weekPagerWidth,
									),
									0,
								),
								weekPageKeys.length - 1,
							);
							visibleWeekPageIndexRef.current = nextPageIndex;
							selectWeekPage(nextPageIndex);
						}}
						onScrollToIndexFailed={({ index }) => {
							weekPagerRef.current?.scrollToOffset({
								animated: true,
								offset: index * weekPagerWidth,
							});
						}}
						pagingEnabled
						renderItem={({ item: weekKey }) => {
							const days = getDashboardWeekDayKeys(weekKey).flatMap(
								(dayKey) => {
									const day = toCalendarDay({ dayKey, todayKey });
									return day ? [day] : [];
								},
							);
							return (
								<View style={{ width: weekPagerWidth }}>
									<WeekCalendar
										days={days}
										selectedDayKey={selectedDayKey}
										onSelectDay={selectDay}
									/>
								</View>
							);
						}}
						showsHorizontalScrollIndicator={false}
						windowSize={3}
					/>
				</View>

				<GestureDetector gesture={daySwipeGesture}>
					<View>
						<View className="px-6 pt-3">
							<CompactDayAgenda
								items={sortDashboardAgendaItems(
									(entriesByDay?.[selectedDayKey] ?? []).map((entry) =>
										toDashboardAgendaItem(selectedDayKey, {
											...entry,
											subject:
												entry.subject ??
												learningPlans?.find(
													(plan) => plan.id === entry.relatedLearningPlanId,
												)?.subject,
										}),
									),
								)}
								isLoading={entriesByDay === undefined}
								onOpenItem={(item) => {
									const planRoute = getAgendaPlanRoute(item.entry);
									if (planRoute) {
										trackFeature(
											"home.entry_opened",
											"performed",
											item.entry.id,
										);
										router.push(planRoute);
									} else {
										openItem(item);
									}
								}}
							/>
						</View>
					</View>
				</GestureDetector>
			</ScrollView>
		</SafeAreaView>
	);
}
