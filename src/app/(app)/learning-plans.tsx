import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { NotificationButton } from "~/components/notification-button";
import {
	ArrowUpRight,
	ClipboardEdit,
	GraduationCap,
	Plus,
	PropertyEdit,
	Route2,
	Trash2,
} from "~/components/ui/icon";
import { NotchedActionCard } from "~/components/ui/notched-action-card";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { getDayKey, parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES } from "~/lib/routes";

const PLAN_ACTION_RAIL_WIDTH = 104;
const PLAN_SWIPE_OPEN_THRESHOLD = 44;
const PLAN_ACTION_RAIL_COLOR = DAYOVA_DESIGN_SYSTEM.colors.buttonNeutral;

type LearningPlanOverview = {
	id: Id<"learningPlans">;
	subject: string;
	examTypeLabel: string;
	status: "draft" | "questionsReady" | "generated" | "accepted";
	progressPercent: number;
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

const getPlanHref = (plan: LearningPlanOverview) => {
	if (plan.status === "draft") return ROUTES.createLearningPlan;
	if (plan.status === "questionsReady") {
		return `/learning-plans/${plan.id}/quiz/0` as const;
	}
	return `/learning-plans/${plan.id}` as const;
};

const differenceInCalendarDays = (laterKey: string, earlierKey: string) => {
	const later = parseDayKey(laterKey);
	const earlier = parseDayKey(earlierKey);
	if (!later || !earlier) return null;
	return Math.ceil((later.getTime() - earlier.getTime()) / 86_400_000);
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
			background: "#EAF9EF",
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
			background: "#FFF3E5",
			foreground: DAYOVA_DESIGN_SYSTEM.colors.warning,
		};
	}
	if (daysUntilSession === 0) {
		return {
			label: "Heute",
			background: "#F1F7FB",
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}
	if (daysUntilSession === 1) {
		return {
			label: "Morgen",
			background: "#F1F7FB",
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}
	return {
		label: "Geplant",
		background: "#F1F7FB",
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
				className="font-poppins font-semibold text-[10px] leading-3"
				style={{ color: foreground }}
			>
				{label}
			</Text>
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
					top: 2,
					bottom: 2,
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
					<PropertyEdit size={26} color="#FFFFFF" strokeWidth={2.1} />
				</TouchableOpacity>
				<View className="h-0.5 w-8 rounded-full bg-white/80" />
				<TouchableOpacity
					accessibilityLabel="Lernplan löschen"
					accessibilityRole="button"
					activeOpacity={0.78}
					onPress={onDelete}
					className="h-10 w-10 items-center justify-center rounded-full"
				>
					<Trash2 size={26} color="#FFFFFF" strokeWidth={2.1} />
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
					<NotchedActionCard
						accessibilityHint="Öffnet diesen Lernplan."
						accessibilityLabel={`${plan.subject}, ${status.label}, ${progress} Prozent`}
						actionAccessibilityLabel={`${plan.subject} öffnen`}
						actionIcon={
							<ArrowUpRight
								size={24}
								color={DAYOVA_DESIGN_SYSTEM.colors.primaryForeground}
								strokeWidth={2.2}
							/>
						}
						onActionPress={onPress}
					>
						<View className="gap-2">
							<View className="flex-row items-start justify-between gap-3">
								<Text
									className="flex-1 font-medium font-poppins text-[20px] text-black leading-7"
									numberOfLines={1}
								>
									{formatGermanUiText(plan.subject)}
								</Text>
								<View className="flex-row gap-1">
									<Badge {...status} />
									<Badge
										label={`${plan.currentSession?.durationMinutes ?? "–"} min`}
										background="#F1F7FB"
										foreground={DAYOVA_DESIGN_SYSTEM.colors.primary}
									/>
								</View>
							</View>

							<View className="flex-row items-center gap-1">
								<GraduationCap size={14} color="#697586" strokeWidth={2} />
								<Text className="font-poppins text-[#697586] text-[12px] leading-[18px]">
									{plan.examDateLabel ?? "Termin wird geladen"}
								</Text>
							</View>

							<Text
								className="font-poppins font-semibold text-[#1E232B] text-[16px] leading-[18px]"
								numberOfLines={2}
							>
								{formatGermanUiText(currentTitle)}
							</Text>
						</View>

						<View className="mt-4 w-[84%] gap-1">
							<View className="flex-row items-center justify-between">
								<Text className="font-poppins text-[#7E7E7E] text-[12px] leading-[18px]">
									{`${plan.completedCount ?? 0} von ${plan.sessionCount ?? 0} Lerntage`}
								</Text>
								<View className="flex-row items-center gap-1">
									<ClipboardEdit size={14} color="#697586" strokeWidth={2} />
									<Text className="font-poppins text-[#697586] text-[12px] leading-[18px]">
										{remainingDays === 1
											? "noch 1 Tag"
											: `noch ${remainingDays} Tage`}
									</Text>
								</View>
							</View>
							<View className="h-2 overflow-hidden rounded-full bg-[#F7F8FB]">
								<View
									className="h-full rounded-full bg-primary"
									style={{
										width: `${Math.max(progress, progress > 0 ? 8 : 0)}%`,
									}}
								/>
							</View>
						</View>
					</NotchedActionCard>
				</Animated.View>
			</GestureDetector>
		</View>
	);
}

export default function LearningPlansScreen() {
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const removePlan = useMutation(api.learningPlans.removePlan);
	const today = useCurrentLocalDay();
	const todayKey = getDayKey(today);
	const plans = useQuery(
		api.learningPlans.listOverview,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const visiblePlans = plans ?? [];

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

	return (
		<View className="flex-1 bg-background">
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingTop: Math.max(insets.top + 30, 54),
					paddingBottom: Math.max(insets.bottom + 120, 150),
					rowGap: 36,
				}}
				showsVerticalScrollIndicator={false}
			>
				<View className="flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-foreground text-heading-2">
						Deine Lernpläne
					</Text>

					<NotificationButton />
				</View>

				<View className="gap-3">
					{visiblePlans.length > 0 ? (
						visiblePlans.map((plan) => (
							<LearningPlanCard
								key={plan.id}
								plan={plan}
								todayKey={todayKey}
								onPress={() => router.push(getPlanHref(plan))}
								onDelete={() => confirmDeletePlan(plan)}
							/>
						))
					) : (
						<View className="items-center rounded-[30px] border border-border/50 bg-card px-5 py-7 shadow-black/5 shadow-lg">
							<View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
								<Route2
									size={30}
									color={DAYOVA_DESIGN_SYSTEM.colors.primary}
									strokeWidth={2.2}
								/>
							</View>
							<Text className="text-center font-poppins font-semibold text-body-1 text-foreground">
								Noch keine Lernpläne
							</Text>
							<Text className="mt-2 text-center font-poppins text-body-3 text-muted-foreground">
								Erstelle einen Lernplan aus einer Prüfung, damit er hier als
								Übersicht erscheint.
							</Text>
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel="Lernplan erstellen"
								activeOpacity={0.9}
								onPress={() => router.push(ROUTES.createExam)}
								className="mt-5 flex-row items-center gap-2 rounded-full bg-foreground px-5 py-3"
							>
								<Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
								<Text className="font-poppins font-semibold text-body-4 text-white">
									Neuen Lernplan starten
								</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
}
