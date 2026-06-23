import { useConvexAuth, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import { NotificationButton } from "~/components/notification-button";
import {
	ClipboardEdit,
	GraduationCap,
	Plus,
	Route2,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { getDayKey, parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES } from "~/lib/routes";

type LearningPlanOverview = {
	id: string;
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

function LearningPlanCard({
	plan,
	todayKey,
	onPress,
}: {
	plan: LearningPlanOverview;
	todayKey: string;
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

	return (
		<TouchableOpacity
			accessibilityHint="Öffnet diesen Lernplan."
			accessibilityLabel={`${plan.subject}, ${status.label}, ${progress} Prozent`}
			accessibilityRole="button"
			activeOpacity={0.9}
			onPress={onPress}
			className="overflow-hidden rounded-[40px] bg-card px-6 py-6 shadow-black/10 shadow-lg"
			style={{ minHeight: 212, borderCurve: "continuous" }}
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
					<LinearGradient
						colors={["#00A0E6", "#4FD8FF"]}
						start={{ x: 0, y: 0.5 }}
						end={{ x: 1, y: 0.5 }}
						style={{
							width: `${Math.max(progress, progress > 0 ? 8 : 0)}%`,
							height: "100%",
							borderRadius: 8,
						}}
					/>
				</View>
			</View>
		</TouchableOpacity>
	);
}

export default function LearningPlansScreen() {
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const todayKey = getDayKey(today);
	const plans = useQuery(
		api.learningPlans.listOverview,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const visiblePlans = plans ?? [];

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
