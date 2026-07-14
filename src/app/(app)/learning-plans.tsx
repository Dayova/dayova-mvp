import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { CreateTypePickerModal } from "~/components/create-type-picker-modal";
import { Button } from "~/components/ui/button";
import {
	ArrowUpRight,
	ClipboardEdit,
	Clock3,
	GraduationCap,
	Plus,
	PropertyEdit,
	Route2,
	Trash2,
} from "~/components/ui/icon";
import {
	CompactNotchedActionCard,
	NotchedActionCard,
} from "~/components/ui/notched-action-card";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { getLearningPlanOverviewState } from "~/features/learning-plans/creation-overview";
import { getDayKey, parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";

const PLAN_ACTION_RAIL_WIDTH = 104;
const PLAN_SWIPE_OPEN_THRESHOLD = 44;
const PLAN_ACTION_RAIL_COLOR = DAYOVA_DESIGN_SYSTEM.colors.buttonNeutral;
const STATUS_NEUTRAL_BACKGROUND = DAYOVA_DESIGN_SYSTEM.colors.systemSubtle;
const STATUS_DUE_BACKGROUND = DAYOVA_DESIGN_SYSTEM.colors.wrongSubtle;
const STATUS_DUE_FOREGROUND = DAYOVA_DESIGN_SYSTEM.colors.wrong;
const PLANS_TAB_SWITCH_HEIGHT = 58;
const PLANS_TAB_SWITCH_PADDING = 6;
const PLANS_TAB_SWITCH_GAP = 12;
const PLANS_TAB_INDICATOR_HEIGHT = 44;

type PlanTab = "learningPlans" | "homework";
type CreateType = "homework" | "exam";

type LearningPlanOverview = {
	id: Id<"learningPlans">;
	subject: string;
	examTypeLabel: string;
	status: "draft" | "questionsReady" | "generated" | "accepted";
	progressPercent: number;
	questionCount?: number;
	answeredQuestionCount?: number;
	firstUnansweredQuestionIndex?: number | null;
	completedCount?: number;
	sessionCount?: number;
	examDateKey?: string;
	examDateLabel?: string;
	currentSession?: {
		id: string;
		title: string;
		goal: string;
		dateKey: string;
		dateLabel: string;
		startTime: string;
		durationMinutes: number;
		completed: boolean;
	} | null;
};

type HomeworkOverview = {
	id: Id<"dayEntries">;
	title: string;
	dayKey: string;
	time: string | null;
	notes: string | null;
	dueDateKey: string | null;
	dueDateLabel: string | null;
	plannedDateLabel: string | null;
	durationMinutes: number | null;
	completed: boolean;
};

const getPlanHref = (plan: LearningPlanOverview) => {
	if (plan.status === "draft") return ROUTES.createLearningPlan;
	const overviewState = getLearningPlanOverviewState(plan);
	if (overviewState.kind === "creation") {
		return overviewState.resumeTarget.kind === "generation"
			? (`/learning-plans/${plan.id}/generating` as const)
			: (`/learning-plans/${plan.id}/quiz/${overviewState.resumeTarget.questionIndex}` as const);
	}
	return `/learning-plans/${plan.id}` as const;
};

const formatDateFromKey = (dayKey: string) => {
	const date = parseDayKey(dayKey);
	if (!date) return "Termin wird geladen";
	return new Intl.DateTimeFormat("de-DE", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);
};

const differenceInCalendarDays = (laterKey: string, earlierKey: string) => {
	const later = parseDayKey(laterKey);
	const earlier = parseDayKey(earlierKey);
	if (!later || !earlier) return null;
	return Math.ceil((later.getTime() - earlier.getTime()) / 86_400_000);
};

const getHomeworkSubject = (homework: HomeworkOverview) =>
	formatGermanUiText(homework.title.replace(/\s*Hausaufgabe\s*$/i, "").trim());

const getHomeworkStatus = (
	homework: HomeworkOverview,
	todayKey: string,
): { label: string; background: string; foreground: string } => {
	if (homework.completed) {
		return {
			label: "Fertig",
			background: DAYOVA_DESIGN_SYSTEM.colors.successSubtle,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.success,
		};
	}

	const comparisonKey = homework.dueDateKey ?? homework.dayKey;
	const remainingDays = differenceInCalendarDays(comparisonKey, todayKey);
	if (remainingDays !== null && remainingDays < 0) {
		return {
			label: "Fällig",
			background: STATUS_DUE_BACKGROUND,
			foreground: STATUS_DUE_FOREGROUND,
		};
	}
	if (remainingDays === 0) {
		return {
			label: "Heute",
			background: STATUS_NEUTRAL_BACKGROUND,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}
	if (remainingDays === 1) {
		return {
			label: "Morgen",
			background: STATUS_NEUTRAL_BACKGROUND,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}
	return {
		label: "Geplant",
		background: STATUS_NEUTRAL_BACKGROUND,
		foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
	};
};

const getStatus = (
	plan: LearningPlanOverview,
	todayKey: string,
): { label: string; background: string; foreground: string } => {
	const sessionCount = plan.sessionCount ?? 0;
	const completedCount = plan.completedCount ?? 0;
	if (sessionCount > 0 && completedCount >= sessionCount) {
		return {
			label: "Fertig",
			background: DAYOVA_DESIGN_SYSTEM.colors.successSubtle,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.success,
		};
	}

	const sessionKey = plan.currentSession?.dateKey;
	const daysUntilSession = sessionKey
		? differenceInCalendarDays(sessionKey, todayKey)
		: null;
	if (daysUntilSession !== null && daysUntilSession < 0) {
		return {
			label: "Fällig",
			background: STATUS_DUE_BACKGROUND,
			foreground: STATUS_DUE_FOREGROUND,
		};
	}
	if (daysUntilSession === 0) {
		return {
			label: "Heute",
			background: STATUS_NEUTRAL_BACKGROUND,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}
	if (daysUntilSession === 1) {
		return {
			label: "Morgen",
			background: STATUS_NEUTRAL_BACKGROUND,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}
	return {
		label: "Geplant",
		background: STATUS_NEUTRAL_BACKGROUND,
		foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
	};
};

function Badge({
	label,
	background,
	foreground,
}: {
	label: string;
	background: string;
	foreground: string;
}) {
	return (
		<View
			className="h-7 justify-center rounded-full px-3"
			style={{ backgroundColor: background }}
		>
			<Text
				className="font-poppins font-semibold text-body-5"
				style={{ color: foreground }}
			>
				{label}
			</Text>
		</View>
	);
}

function PlansTabSwitch({
	activeTab,
	onChange,
}: {
	activeTab: PlanTab;
	onChange: (tab: PlanTab) => void;
}) {
	const tabs: Array<{ key: PlanTab; label: string }> = [
		{ key: "learningPlans", label: "Lernpläne" },
		{ key: "homework", label: "Hausaufgaben" },
	];
	const [switchWidth, setSwitchWidth] = useState(0);
	const activeTabIndex = activeTab === "learningPlans" ? 0 : 1;
	const indicatorPosition = useSharedValue(activeTabIndex);
	const indicatorWidth =
		switchWidth > 0
			? (switchWidth - PLANS_TAB_SWITCH_PADDING * 2 - PLANS_TAB_SWITCH_GAP) / 2
			: 0;

	useEffect(() => {
		indicatorPosition.set(
			withSpring(activeTabIndex, {
				damping: 17,
				mass: 0.72,
				stiffness: 210,
			}),
		);
	}, [activeTabIndex, indicatorPosition]);

	const indicatorStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateX:
					indicatorPosition.get() * (indicatorWidth + PLANS_TAB_SWITCH_GAP),
			},
		],
	}));

	return (
		<View
			accessibilityRole="tablist"
			className="flex-row items-center border border-border bg-card"
			onLayout={({ nativeEvent }) => {
				setSwitchWidth(nativeEvent.layout.width);
			}}
			style={{
				height: PLANS_TAB_SWITCH_HEIGHT,
				borderRadius: 44,
				padding: PLANS_TAB_SWITCH_PADDING,
				columnGap: PLANS_TAB_SWITCH_GAP,
			}}
		>
			{indicatorWidth > 0 ? (
				<Animated.View
					pointerEvents="none"
					style={[
						{
							position: "absolute",
							left: PLANS_TAB_SWITCH_PADDING,
							top: PLANS_TAB_SWITCH_PADDING,
							width: indicatorWidth,
							height: PLANS_TAB_INDICATOR_HEIGHT,
							borderRadius: 44,
							overflow: "hidden",
						},
						indicatorStyle,
					]}
				>
					<LinearGradient
						colors={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors}
						start={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start}
						end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
						style={{ flex: 1 }}
					/>
				</Animated.View>
			) : null}
			{tabs.map((tab) => {
				const isActive = tab.key === activeTab;
				return (
					<TouchableOpacity
						key={tab.key}
						accessibilityRole="tab"
						accessibilityState={{ selected: isActive }}
						activeOpacity={0.9}
						onPress={() => onChange(tab.key)}
						style={{
							flex: 1,
							minWidth: 0,
							height: PLANS_TAB_INDICATOR_HEIGHT,
							borderRadius: 44,
						}}
					>
						<View className="h-full w-full items-center justify-center rounded-[44px]">
							<Text
								className={
									isActive
										? "font-poppins font-semibold text-body-2"
										: "font-poppins font-semibold text-body-2 text-text"
								}
								numberOfLines={1}
								style={
									isActive
										? { color: DAYOVA_DESIGN_SYSTEM.colors.light1 }
										: undefined
								}
							>
								{tab.label}
							</Text>
						</View>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

function LearningPlanActionRail({
	onDelete,
	onEdit,
	style,
}: {
	onDelete: () => void;
	onEdit: () => void;
	style?: object;
}) {
	return (
		<Animated.View
			className="absolute right-0 w-[196px] items-end justify-center overflow-hidden pr-5"
			style={[
				{
					top: 0,
					bottom: 0,
					backgroundColor: PLAN_ACTION_RAIL_COLOR,
					borderTopRightRadius: 40,
					borderBottomRightRadius: 40,
				},
				style,
			]}
		>
			<View className="items-center gap-4">
				<TouchableOpacity
					accessibilityLabel="Lernplan bearbeiten"
					accessibilityRole="button"
					activeOpacity={0.78}
					onPress={onEdit}
					className="h-10 w-10 items-center justify-center rounded-full"
				>
					<PropertyEdit
						size={26}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2.1}
					/>
				</TouchableOpacity>
				<View className="h-0.5 w-8 rounded-full bg-light-1" />
				<TouchableOpacity
					accessibilityLabel="Lernplan löschen"
					accessibilityRole="button"
					activeOpacity={0.78}
					onPress={onDelete}
					className="h-10 w-10 items-center justify-center rounded-full"
				>
					<Trash2
						size={26}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2.1}
					/>
				</TouchableOpacity>
			</View>
		</Animated.View>
	);
}

function LearningPlanCard({
	plan,
	todayKey,
	onDelete,
	onPress,
}: {
	plan: LearningPlanOverview;
	todayKey: string;
	onDelete: () => void;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	const overviewState = getLearningPlanOverviewState(plan);
	const progress = Math.max(0, Math.min(plan.progressPercent, 100));
	const status = getStatus(plan, todayKey);
	const remainingDays = Math.max(
		0,
		plan.examDateKey
			? (differenceInCalendarDays(plan.examDateKey, todayKey) ?? 0)
			: 0,
	);
	const currentTitle =
		plan.currentSession?.goal ||
		plan.currentSession?.title ||
		plan.examTypeLabel;
	const [isActionRailVisible, setIsActionRailVisible] = useState(false);
	const translateX = useSharedValue(0);
	const gestureStartX = useSharedValue(0);
	const cardAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.get() }],
	}));
	const actionRailAnimatedStyle = useAnimatedStyle(() => ({
		opacity: interpolate(
			-translateX.get(),
			[0, 8, PLAN_ACTION_RAIL_WIDTH],
			[0, 0, 1],
			"clamp",
		),
	}));
	const panGesture = Gesture.Pan()
		.activeOffsetX([-10, 10])
		.failOffsetY([-12, 12])
		.onBegin(() => {
			"worklet";
			gestureStartX.set(translateX.get());
			scheduleOnRN(setIsActionRailVisible, true);
		})
		.onUpdate((event) => {
			"worklet";
			translateX.set(
				Math.max(
					Math.min(gestureStartX.get() + event.translationX, 0),
					-PLAN_ACTION_RAIL_WIDTH,
				),
			);
		})
		.onEnd(() => {
			"worklet";
			const shouldOpen = -translateX.get() >= PLAN_SWIPE_OPEN_THRESHOLD;
			translateX.set(
				shouldOpen
					? withTiming(-PLAN_ACTION_RAIL_WIDTH, {
							duration: 180,
							easing: Easing.out(Easing.cubic),
						})
					: withSpring(
							0,
							{
								damping: 20,
								mass: 0.7,
								overshootClamping: true,
								stiffness: 260,
							},
							(finished) => {
								"worklet";
								if (finished) scheduleOnRN(setIsActionRailVisible, false);
							},
						),
			);
		});
	const editPlan = () => {
		translateX.set(0);
		setIsActionRailVisible(false);
		router.push(`/learning-plans/new?learningPlanId=${plan.id}` as const);
	};
	const deletePlan = () => {
		translateX.set(0);
		setIsActionRailVisible(false);
		onDelete();
	};

	return (
		<View className="relative rounded-[40px]">
			{isActionRailVisible ? (
				<LearningPlanActionRail
					onDelete={deletePlan}
					onEdit={editPlan}
					style={actionRailAnimatedStyle}
				/>
			) : null}
			<GestureDetector gesture={panGesture}>
				<Animated.View style={cardAnimatedStyle}>
					{overviewState.kind === "creation" ? (
						<CompactNotchedActionCard
							cardHeight={184}
							cardAccessibilityHint="Setzt die Lernplan-Erstellung bei der ersten noch offenen Frage fort."
							cardAccessibilityLabel={`${formatGermanUiText(plan.subject)}, ${overviewState.badgeLabel}, ${plan.examDateLabel ?? "Termin wird geladen"}, ${overviewState.progressLabel}`}
							actionIcon={
								<ArrowUpRight
									size={24}
									color={DAYOVA_DESIGN_SYSTEM.colors.light1}
									strokeWidth={1.9}
								/>
							}
							onPress={onPress}
							pressType="card"
						>
							<View className="gap-3">
								<View className="flex-row items-start justify-between gap-3">
									<Text
										className="min-w-0 flex-1 pr-2 font-poppins font-semibold text-body-1 text-text"
										numberOfLines={2}
									>
										{formatGermanUiText(plan.subject)}
									</Text>
									<Badge
										label={overviewState.badgeLabel}
										background={STATUS_NEUTRAL_BACKGROUND}
										foreground={DAYOVA_DESIGN_SYSTEM.colors.primary}
									/>
								</View>
								<View className="flex-row items-center gap-1">
									<GraduationCap
										size={14}
										color={colors.secondaryText}
										strokeWidth={2}
									/>
									<Text className="font-poppins text-body-4 text-secondary-text">
										{plan.examDateLabel ?? "Termin wird geladen"}
									</Text>
								</View>
								<Text
									className="max-w-[282px] font-poppins font-semibold text-body-2 text-text"
									numberOfLines={2}
								>
									{overviewState.actionLabel}
								</Text>
								<View className="flex-row items-center gap-2">
									<ClipboardEdit
										size={14}
										color={colors.secondaryText}
										strokeWidth={2}
									/>
									<Text className="font-poppins text-body-4 text-secondary-text">
										{overviewState.progressLabel}
									</Text>
								</View>
							</View>
						</CompactNotchedActionCard>
					) : (
						<NotchedActionCard
							cardAccessibilityHint="Öffnet diesen Lernplan und zeigt die zugehörigen Lernsessions an."
							cardAccessibilityLabel={`${formatGermanUiText(plan.subject)}, ${status.label}, ${plan.examDateLabel ?? "Termin wird geladen"}, ${formatGermanUiText(currentTitle)}, ${plan.completedCount ?? 0} von ${plan.sessionCount ?? 0} Lerntage, ${remainingDays === 1 ? "noch 1 Tag" : `noch ${remainingDays} Tage`}`}
							actionIcon={
								<ArrowUpRight
									size={24}
									color={DAYOVA_DESIGN_SYSTEM.colors.light1}
									strokeWidth={1.9}
								/>
							}
							onPress={onPress}
							pressType="card"
						>
							<View className="gap-2">
								<View className="flex-row items-start justify-between gap-3">
									<Text
										className="min-w-0 flex-1 pr-2 font-poppins font-semibold text-body-1 text-text"
										numberOfLines={2}
									>
										{formatGermanUiText(plan.subject)}
									</Text>
									<View className="shrink-0 flex-row gap-2">
										<Badge {...status} />
										<Badge
											label={`${plan.currentSession?.durationMinutes ?? "–"} min`}
											background={STATUS_NEUTRAL_BACKGROUND}
											foreground={DAYOVA_DESIGN_SYSTEM.colors.primary}
										/>
									</View>
								</View>

								<View className="flex-row items-center gap-1">
									<GraduationCap
										size={14}
										color={DAYOVA_DESIGN_SYSTEM.colors.secondaryText}
										strokeWidth={2}
									/>
									<Text className="font-poppins text-body-4 text-secondary-text">
										{plan.examDateLabel ?? "Termin wird geladen"}
									</Text>
								</View>

								<Text
									className="max-w-[282px] font-poppins font-semibold text-body-2 text-text"
									numberOfLines={2}
								>
									{formatGermanUiText(currentTitle)}
								</Text>
							</View>

							<View className="mt-4 w-full max-w-[300px] gap-1">
								<View className="flex-row items-center">
									<Text className="w-[172px] font-poppins text-body-4 text-secondary-text">
										{`${plan.completedCount ?? 0} von ${plan.sessionCount ?? 0} Lerntage`}
									</Text>
									<View className="flex-row items-center gap-1">
										<ClipboardEdit
											size={14}
											color={DAYOVA_DESIGN_SYSTEM.colors.secondaryText}
											strokeWidth={2}
										/>
										<Text className="font-poppins text-body-4 text-secondary-text">
											{remainingDays === 1
												? "noch 1 Tag"
												: `noch ${remainingDays} Tage`}
										</Text>
									</View>
								</View>
								<View
									accessibilityLabel={`${progress} Prozent abgeschlossen`}
									accessibilityValue={{
										max: 100,
										min: 0,
										now: progress,
										text: `${progress} Prozent`,
									}}
									accessibilityRole="progressbar"
									className="h-2 w-[258px] max-w-full overflow-hidden rounded-full bg-light-2"
								>
									<LinearGradient
										colors={
											DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors
										}
										start={
											DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.start
										}
										end={DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.end}
										style={{
											height: "100%",
											width: `${Math.max(progress, progress > 0 ? 8 : 0)}%`,
											borderRadius: 999,
										}}
									/>
								</View>
							</View>
						</NotchedActionCard>
					)}
				</Animated.View>
			</GestureDetector>
		</View>
	);
}

function HomeworkCard({
	homework,
	todayKey,
	onDelete,
	onPress,
}: {
	homework: HomeworkOverview;
	todayKey: string;
	onDelete: () => void;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	const status = getHomeworkStatus(homework, todayKey);
	const subject = getHomeworkSubject(homework) || "Hausaufgabe";
	const dateLabel =
		homework.plannedDateLabel ?? formatDateFromKey(homework.dayKey);
	const details = `${dateLabel}${homework.time ? ` • ${homework.time}` : ""}`;
	const description = formatGermanUiText(
		homework.notes?.trim() || homework.title,
	);
	const [isActionRailVisible, setIsActionRailVisible] = useState(false);
	const translateX = useSharedValue(0);
	const gestureStartX = useSharedValue(0);
	const cardAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.get() }],
	}));
	const actionRailAnimatedStyle = useAnimatedStyle(() => ({
		opacity: interpolate(
			-translateX.get(),
			[0, 8, PLAN_ACTION_RAIL_WIDTH],
			[0, 0, 1],
			"clamp",
		),
	}));
	const panGesture = Gesture.Pan()
		.activeOffsetX([-10, 10])
		.failOffsetY([-12, 12])
		.onBegin(() => {
			"worklet";
			gestureStartX.set(translateX.get());
			scheduleOnRN(setIsActionRailVisible, true);
		})
		.onUpdate((event) => {
			"worklet";
			translateX.set(
				Math.max(
					Math.min(gestureStartX.get() + event.translationX, 0),
					-PLAN_ACTION_RAIL_WIDTH,
				),
			);
		})
		.onEnd(() => {
			"worklet";
			const shouldOpen = -translateX.get() >= PLAN_SWIPE_OPEN_THRESHOLD;
			translateX.set(
				shouldOpen
					? withTiming(-PLAN_ACTION_RAIL_WIDTH, {
							duration: 180,
							easing: Easing.out(Easing.cubic),
						})
					: withSpring(
							0,
							{
								damping: 20,
								mass: 0.7,
								overshootClamping: true,
								stiffness: 260,
							},
							(finished) => {
								"worklet";
								if (finished) scheduleOnRN(setIsActionRailVisible, false);
							},
						),
			);
		});
	const editHomework = () => {
		translateX.set(0);
		setIsActionRailVisible(false);
		onPress();
	};
	const deleteHomework = () => {
		translateX.set(0);
		setIsActionRailVisible(false);
		onDelete();
	};

	return (
		<View className="relative rounded-[40px]">
			{isActionRailVisible ? (
				<LearningPlanActionRail
					onDelete={deleteHomework}
					onEdit={editHomework}
					style={actionRailAnimatedStyle}
				/>
			) : null}
			<GestureDetector gesture={panGesture}>
				<Animated.View style={cardAnimatedStyle}>
					<CompactNotchedActionCard
						cardAccessibilityHint="Öffnet diese Hausaufgabe und zeigt alle relevanten Informationen dazu an."
						cardAccessibilityLabel={`${subject}, ${status.label}, ${details}, ${description}`}
						actionIcon={
							<ArrowUpRight
								size={24}
								color={DAYOVA_DESIGN_SYSTEM.colors.light1}
								strokeWidth={1.9}
							/>
						}
						onPress={onPress}
						pressType="card"
					>
						<View className="gap-2">
							<View className="flex-row items-start justify-between gap-3">
								<Text
									className="min-w-0 flex-1 pr-2 font-poppins font-semibold text-body-1 text-text"
									numberOfLines={2}
								>
									{subject}
								</Text>
								<View className="shrink-0 flex-row gap-2">
									<Badge {...status} />
									<Badge
										label={`${homework.durationMinutes ?? "–"} min`}
										background={STATUS_NEUTRAL_BACKGROUND}
										foreground={DAYOVA_DESIGN_SYSTEM.colors.primary}
									/>
								</View>
							</View>

							<View className="flex-row items-center gap-1">
								<Clock3
									size={14}
									color={colors.secondaryText}
									strokeWidth={2}
								/>
								<Text
									className="flex-1 font-poppins text-body-4 text-secondary-text"
									numberOfLines={1}
								>
									{details}
								</Text>
							</View>

							<Text
								className="max-w-[282px] font-poppins font-semibold text-body-4 text-text"
								numberOfLines={2}
							>
								{description}
							</Text>
						</View>
					</CompactNotchedActionCard>
				</Animated.View>
			</GestureDetector>
		</View>
	);
}

export default function LearningPlansScreen() {
	const insets = useSafeAreaInsets();
	const { colors } = useDayovaTheme();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const removePlan = useMutation(api.learningPlans.removePlan);
	const removeHomework = useMutation(api.dayEntries.remove);
	const [activeTab, setActiveTab] = useState<PlanTab>("learningPlans");
	const [showCreateTypePicker, setShowCreateTypePicker] = useState(false);
	const today = useCurrentLocalDay();
	const todayKey = getDayKey(today);
	const plans = useQuery(
		api.learningPlans.listOverview,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const homework = useQuery(
		api.dayEntries.listHomeworkOverview,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const visiblePlans = plans ?? [];
	const visibleHomework = homework ?? [];
	const creationPlans = visiblePlans.filter(
		(plan) => getLearningPlanOverviewState(plan).kind === "creation",
	);
	const createdPlans = visiblePlans.filter(
		(plan) => getLearningPlanOverviewState(plan).kind === "created",
	);

	const confirmDeletePlan = (plan: LearningPlanOverview) => {
		Alert.alert(
			"Lernplan löschen",
			`Möchtest du den Lernplan ${formatGermanUiText(plan.subject)} wirklich löschen?`,
			[
				{ text: "Abbrechen", style: "cancel" },
				{
					text: "Löschen",
					style: "destructive",
					onPress: () => {
						void removePlan({ id: plan.id }).catch(() => {
							Alert.alert(
								"Lernplan konnte nicht gelöscht werden",
								"Bitte versuche es gleich noch einmal.",
							);
						});
					},
				},
			],
		);
	};
	const confirmDeleteHomework = (homeworkEntry: HomeworkOverview) => {
		Alert.alert(
			"Hausaufgabe löschen",
			`Möchtest du ${formatGermanUiText(homeworkEntry.title)} wirklich löschen?`,
			[
				{ text: "Abbrechen", style: "cancel" },
				{
					text: "Löschen",
					style: "destructive",
					onPress: () => {
						void removeHomework({ id: homeworkEntry.id }).catch(() => {
							Alert.alert(
								"Hausaufgabe konnte nicht gelöscht werden",
								"Bitte versuche es gleich noch einmal.",
							);
						});
					},
				},
			],
		);
	};
	const openCreateTypePicker = () => {
		setShowCreateTypePicker(true);
	};
	const selectCreateType = (type: CreateType) => {
		setShowCreateTypePicker(false);
		router.push(
			type === "homework" ? ROUTES.createHomework : ROUTES.createExam,
		);
	};

	return (
		<View className="flex-1 bg-background">
			<ThemedStatusBar />
			<View
				className="gap-6 px-6"
				style={{
					paddingTop: Math.max(insets.top - 4, 32),
					paddingBottom: 18,
				}}
			>
				<View className="mt-7 flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-heading-1 text-text">
						Deine Pläne
					</Text>

					<TouchableOpacity
						accessibilityRole="button"
						accessibilityLabel="Neuen Eintrag erstellen."
						accessibilityHint="Öffnet den Eintragserstellungsdialog, um entweder eine Prüfung oder Hausaufgabe zu erstellen."
						activeOpacity={0.88}
						onPress={openCreateTypePicker}
						className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
					>
						<Plus size={28} color={colors.text} strokeWidth={1.8} />
					</TouchableOpacity>
				</View>

				<PlansTabSwitch activeTab={activeTab} onChange={setActiveTab} />
			</View>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingTop: 0,
					paddingBottom: Math.max(insets.bottom + 120, 150),
				}}
				showsVerticalScrollIndicator={false}
			>
				{activeTab === "learningPlans" ? (
					<View className="gap-7">
						{visiblePlans.length > 0 ? (
							<>
								{creationPlans.length > 0 ? (
									<View className="gap-3">
										<Text className="font-poppins font-semibold text-body-2 text-text">
											In Erstellung
										</Text>
										{creationPlans.map((plan) => (
											<LearningPlanCard
												key={plan.id}
												plan={plan}
												todayKey={todayKey}
												onPress={() => router.push(getPlanHref(plan))}
												onDelete={() => confirmDeletePlan(plan)}
											/>
										))}
									</View>
								) : null}
								{createdPlans.length > 0 ? (
									<View className="gap-3">
										{creationPlans.length > 0 ? (
											<Text className="font-poppins font-semibold text-body-2 text-text">
												Lernpläne
											</Text>
										) : null}
										{createdPlans.map((plan) => (
											<LearningPlanCard
												key={plan.id}
												plan={plan}
												todayKey={todayKey}
												onPress={() => router.push(getPlanHref(plan))}
												onDelete={() => confirmDeletePlan(plan)}
											/>
										))}
									</View>
								) : null}
							</>
						) : (
							<View className="items-center gap-3 rounded-[30px] border border-border bg-card px-5 py-7">
								<View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
									<Route2
										size={30}
										color={DAYOVA_DESIGN_SYSTEM.colors.primary}
										strokeWidth={2.2}
									/>
								</View>
								<Text className="text-center font-poppins font-semibold text-body-1 text-text">
									Noch keine Lernpläne
								</Text>
								<Text className="text-center font-poppins text-body-3 text-secondary-text">
									Erstelle einen Lernplan aus einer Prüfung, damit er hier als
									Übersicht erscheint.
								</Text>
								<Button
									accessibilityLabel="Lernplan erstellen"
									onPress={() => router.push(ROUTES.createExam)}
									size="sm"
									className="mt-2"
								>
									<Plus
										size={18}
										color={DAYOVA_DESIGN_SYSTEM.colors.light1}
										strokeWidth={2.4}
									/>
									<Text className="font-poppins font-semibold text-body-4">
										Neuen Lernplan starten
									</Text>
								</Button>
							</View>
						)}
					</View>
				) : (
					<View className="gap-3">
						{visibleHomework.length > 0 ? (
							visibleHomework.map((homeworkEntry) => (
								<HomeworkCard
									key={homeworkEntry.id}
									homework={homeworkEntry}
									todayKey={todayKey}
									onDelete={() => confirmDeleteHomework(homeworkEntry)}
									onPress={() =>
										router.push(`/entry/${homeworkEntry.id}` as const)
									}
								/>
							))
						) : (
							<View className="items-center gap-3 rounded-[30px] border border-border bg-card px-5 py-7">
								<View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
									<ClipboardEdit
										size={30}
										color={DAYOVA_DESIGN_SYSTEM.colors.primary}
										strokeWidth={2.2}
									/>
								</View>
								<Text className="text-center font-poppins font-semibold text-body-1 text-text">
									Noch keine Hausaufgaben
								</Text>
								<Text className="text-center font-poppins text-body-3 text-secondary-text">
									Trage deine nächste Hausaufgabe ein, damit sie hier als
									Übersicht erscheint.
								</Text>
								<Button
									accessibilityLabel="Hausaufgabe erstellen"
									onPress={() => router.push(ROUTES.createHomework)}
									size="sm"
									className="mt-2"
								>
									<Plus
										size={18}
										color={DAYOVA_DESIGN_SYSTEM.colors.light1}
										strokeWidth={2.4}
									/>
									<Text className="font-poppins font-semibold text-body-4">
										Neue Hausaufgabe eintragen
									</Text>
								</Button>
							</View>
						)}
					</View>
				)}
			</ScrollView>
			<CreateTypePickerModal
				visible={showCreateTypePicker}
				onRequestClose={() => setShowCreateTypePicker(false)}
				onSelect={selectCreateType}
			/>
		</View>
	);
}
