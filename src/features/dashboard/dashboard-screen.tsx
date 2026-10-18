import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-screens/experimental";
import { api } from "#convex/_generated/api";
import { CreateEntryButton } from "~/components/create-entry-button";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { getDayKey, parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { triggerSelectionHaptic } from "~/lib/safe-haptics";
import { useDayovaTheme } from "~/lib/theme";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";
import type { DayEntry } from "~/types/dayEntries";
import { getAgendaPlanRoute } from "./agenda-plan-route";
import { CalendarPager } from "./calendar-pager";
import { CompactDayAgenda } from "./compact-day-agenda";
import {
	type DashboardAgendaItem,
	getAgendaEntryTitle,
	getDashboardCalendarDayKeys,
	getDashboardRelevantDayKeys,
	getDashboardWeekDayKeys,
	getDashboardWeekSelection,
	getVisibleDashboardEntries,
	sortDashboardAgendaItems,
	toDashboardAgendaItem,
} from "./dashboard-agenda";
import { DashboardCalendarHeader } from "./dashboard-calendar-header";
import { getDashboardNextStepFallbackAction } from "./dashboard-empty-state";
import { TodayLearningCard } from "./today-learning-card";
import { getTodaySummary } from "./today-summary";
import { useNextLearningStep } from "./use-next-learning-step";
import { CalendarWeekdays, WeekCalendar } from "./week-calendar";

const triggerDaySelectionHaptic = () => {
	void triggerSelectionHaptic({
		platform: process.env.EXPO_OS,
		selectionAsync: () => Haptics.selectionAsync(),
	});
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

/** Coordinates the independent next-step hero and synchronized calendar/day agenda. */
export function DashboardScreen() {
	const { colors } = useDayovaTheme();
	const router = useRouter();
	const trackFeature = useFeatureAnalytics();
	const params = useLocalSearchParams<{ dayKey?: string }>();
	const insets = useSafeAreaInsets();
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
	const selectedDate = parseDayKey(selectedDayKey) ?? today;

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
	const {
		item: nextLearningStep,
		plan: nextLearningPlan,
		isLoading: isNextStepLoading,
	} = useNextLearningStep(todayKey, Boolean(user && isConvexAuthenticated));
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

	const selectWeekPage = useCallback(
		(nextPageIndex: number) => {
			const weekDelta = nextPageIndex - selectedWeekPageIndex;
			if (weekDelta === 0) return;
			const nextDayKey = getDashboardWeekSelection({
				selectedDayKey,
				weekDelta,
				dayPagerKeys,
			});
			if (!nextDayKey) return;
			commitSelectedDay(nextDayKey);
			triggerDaySelectionHaptic();
		},
		[commitSelectedDay, dayPagerKeys, selectedDayKey, selectedWeekPageIndex],
	);

	const openItem = useCallback(
		(item: DashboardAgendaItem, returnTo = ROUTES.home) => {
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
		() => router.push(withReturnTo(nextStepFallbackAction.route, ROUTES.home)),
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
				<View className="flex-row items-center justify-between gap-6">
					<View className="min-w-0 flex-1 justify-center gap-1">
						<Text
							accessibilityRole="header"
							className="font-poppins font-semibold text-heading-2 text-text"
							numberOfLines={1}
						>
							{firstName ? `Hallo ${firstName}` : "Dein Tag"}
						</Text>
						<Text variant="small" className="font-poppins text-secondary-text">
							{getTodaySummary(entriesByDay?.[todayKey])}
						</Text>
					</View>
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
				<View className="px-6 py-8" testID="dashboard-next-step">
					<View className="h-1" accessible={false} />
					<TodayLearningCard
						todayKey={todayKey}
						plan={nextLearningPlan}
						fallbackAction={nextStepFallbackAction}
						item={nextLearningStep}
						isLoading={isNextStepLoading || learningPlans === undefined}
						onOpenFallback={openNextStepFallback}
						onOpenItem={(item) => openItem(item, ROUTES.home)}
					/>
					<View className="h-6" accessible={false} />
				</View>
				<View className="px-6" testID="dashboard-calendar">
					<DashboardCalendarHeader
						selectedDate={selectedDate}
						createAction={<CreateEntryButton returnTo={ROUTES.home} />}
						onToday={() => {
							if (!dayPagerKeys.includes(todayKey)) {
								setDayPagerKeys(
									getDashboardCalendarDayKeys({ anchorDayKey: todayKey }),
								);
							}
							commitSelectedDay(todayKey);
						}}
					/>
					<CalendarWeekdays />
					<View className="border-border border-b">
						<CalendarPager
							testID="calendar-week-pager"
							keys={weekPageKeys}
							selectedKey={weekPageKeys[selectedWeekPageIndex]}
							minimumHeight={68}
							onSelect={(key) => selectWeekPage(weekPageKeys.indexOf(key))}
							renderPage={(weekKey) => (
								<WeekCalendar
									weekKey={weekKey}
									todayKey={todayKey}
									selectedDayKey={selectedDayKey}
									entriesByDay={entriesByDay}
									onSelectDay={(key) => {
										if (dayPagerKeys.includes(key)) commitSelectedDay(key);
									}}
								/>
							)}
						/>
					</View>
				</View>

				<CalendarPager
					testID="calendar-day-pager"
					keys={dayPagerKeys}
					selectedKey={selectedDayKey}
					minimumHeight={180}
					onSelect={(key) => {
						commitSelectedDay(key);
						triggerDaySelectionHaptic();
					}}
					renderPage={(dayKey) => (
						<View className="px-6 pt-4">
							<CompactDayAgenda
								items={sortDashboardAgendaItems(
									(entriesByDay?.[dayKey] ?? []).map((entry) =>
										toDashboardAgendaItem(dayKey, {
											...entry,
											subject:
												entry.subject ??
												learningPlans?.find(
													(plan) => plan.id === entry.relatedLearningPlanId,
												)?.subject,
										}),
									),
								)}
								isLoading={entriesByDay?.[dayKey] === undefined}
								onOpenItem={(item) => {
									const planRoute = getAgendaPlanRoute(item.entry);
									if (planRoute) {
										router.push(planRoute);
									} else {
										openItem(item);
									}
								}}
							/>
						</View>
					)}
				/>
			</ScrollView>
		</SafeAreaView>
	);
}
