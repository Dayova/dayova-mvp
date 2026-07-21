import { useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import {
	getCurrentLearningPathIndex,
	getLearningPathNodeState,
} from "~/components/learning-plans/learning-path-layout";
import { LearningPath } from "~/components/learning-plans/learning-path";
import { ScreenHeader } from "~/components/screen-header";
import {
	ArrowUpRight,
	BookOpen,
	Dumbbell,
	Rocket,
	Time04,
} from "~/components/ui/icon";
import { CompactNotchedActionCard } from "~/components/ui/notched-action-card";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import type {
	LearningPlanSnapshot,
	PlanSession,
} from "~/features/learning-plans/types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { goBackOrReplace } from "~/lib/navigation";
import { useDayovaTheme } from "~/lib/theme";

const PHASE_LABEL: Record<PlanSession["phase"], string> = {
	theory: "Theorie",
	practice: "Üben",
	rehearsal: "Praxis",
};

const PHASE_COLOR: Record<
	PlanSession["phase"],
	{ background: string; foreground: string }
> = {
	theory: {
		background: DAYOVA_DESIGN_SYSTEM.colors.theorieSubtle,
		foreground: DAYOVA_DESIGN_SYSTEM.colors.theorie,
	},
	practice: {
		background: DAYOVA_DESIGN_SYSTEM.colors.uebenSubtle,
		foreground: DAYOVA_DESIGN_SYSTEM.colors.ueben,
	},
	rehearsal: {
		background: DAYOVA_DESIGN_SYSTEM.colors.praxisSubtle,
		foreground: DAYOVA_DESIGN_SYSTEM.colors.praxis,
	},
};

const PHASE_ICON = {
	theory: BookOpen,
	practice: Dumbbell,
	rehearsal: Rocket,
} satisfies Record<PlanSession["phase"], typeof Dumbbell>;

const screenContentStyle = { rowGap: 28 } satisfies ViewStyle;
const SESSION_PREVIEW_CARD_HEIGHT = 174;

const getSessionRoute = (
	planId: Id<"learningPlans">,
	sessionId: Id<"learningPlanSessions">,
) => `/learning-plans/${planId}/sessions/${sessionId}` as const;

function SessionPreviewCard({
	canOpen,
	onOpen,
	session,
}: {
	canOpen: boolean;
	onOpen: () => void;
	session: PlanSession;
}) {
	const { colors } = useDayovaTheme();
	const phase = PHASE_COLOR[session.phase];
	const PhaseIcon = PHASE_ICON[session.phase];
	const title = formatGermanUiText(session.title);
	const description = formatGermanUiText(session.goal);

	return (
		<CompactNotchedActionCard
			actionAccessibilityHint={
				canOpen
					? "Öffnet die ausgewählte Lerneinheit."
					: "Dieser Lernblock ist noch gesperrt und wird erst nach dem vorherigen Lernblock freigeschaltet."
			}
			actionAccessibilityLabel={
				canOpen
					? `Lerneinheit ${title} öffnen`
					: `Lerneinheit ${title} ist gesperrt`
			}
			actionDisabled={!canOpen}
			actionIcon={
				<ArrowUpRight
					size={24}
					color={DAYOVA_DESIGN_SYSTEM.colors.light1}
					strokeWidth={1.9}
				/>
			}
			actionOffsetBottom={4}
			cardHeight={SESSION_PREVIEW_CARD_HEIGHT}
			cardStyle={{ paddingTop: 22, paddingBottom: 24 }}
			onPress={onOpen}
			pressType="action"
		>
			<View className="gap-2">
				<View className="flex-row items-start justify-between gap-3">
					<Text
						className="min-w-0 flex-1 pr-2 font-poppins font-semibold text-body-2 text-text"
						numberOfLines={2}
					>
						{title}
					</Text>

					<View className="shrink-0 flex-row items-center justify-end gap-2">
						<View
							className="flex-row items-center gap-1 rounded-full px-2.5 py-1.5"
							style={{ backgroundColor: phase.background }}
						>
							<PhaseIcon size={12} color={phase.foreground} strokeWidth={2.1} />
							<Text
								className="font-poppins font-semibold text-body-5"
								style={{ color: phase.foreground }}
							>
								{PHASE_LABEL[session.phase]}
							</Text>
						</View>

						<View className="rounded-full bg-system-subtle px-3 py-1.5">
							<Text className="font-poppins font-semibold text-body-5 text-primary">
								{`${session.durationMinutes} min`}
							</Text>
						</View>
					</View>
				</View>

				<View className="flex-row items-center gap-1.5">
					<Time04 size={13} color={colors.secondaryText} strokeWidth={2} />
					<Text className="font-poppins text-body-4 text-secondary-text">
						{session.dateLabel}
					</Text>
				</View>

				<Text
					className="max-w-[292px] font-poppins text-body-4 text-secondary-text"
					numberOfLines={2}
				>
					{description}
				</Text>
			</View>
		</CompactNotchedActionCard>
	);
}

export default function LearningPlanSessionsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const [selectedSessionId, setSelectedSessionId] =
		useState<Id<"learningPlanSessions"> | null>(null);
	const defaultSession =
		snapshot?.sessions.find((session) => !session.completed) ??
		snapshot?.sessions.at(-1) ??
		null;
	const selectedSession =
		snapshot?.sessions.find((session) => session.id === selectedSessionId) ??
		defaultSession;
	const selectedSessionIndex =
		snapshot && selectedSession
			? snapshot.sessions.findIndex(
					(session) => session.id === selectedSession.id,
				)
			: -1;
	const selectedSessionState =
		snapshot && selectedSession && selectedSessionIndex >= 0
			? getLearningPathNodeState(
					selectedSession,
					selectedSessionIndex,
					getCurrentLearningPathIndex(snapshot.sessions),
				)
			: null;
	const canOpenSelectedSession =
		selectedSessionState !== null && selectedSessionState !== "locked";

	const goBack = () => {
		goBackOrReplace(router, "/learning-plans");
	};

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ThemedStatusBar />
			<View
				className="px-4"
				style={{
					paddingTop: Math.max(insets.top + 8, 24),
					paddingBottom: 16,
				}}
			>
				<ScreenHeader
					className="mb-0"
					onBack={goBack}
					title="Lernplan"
					titleClassName="text-center font-poppins font-semibold text-[22px] text-text leading-[30px]"
				/>
			</View>

			<View className="px-4 pb-5">
				{snapshot === null ? (
					<View className="items-center py-10">
						<ActivityIndicator
							accessibilityLabel="Lernplan wird geladen"
							color={DAYOVA_DESIGN_SYSTEM.colors.primary}
							size="small"
						/>
					</View>
				) : selectedSession ? (
					<SessionPreviewCard
						canOpen={canOpenSelectedSession}
						onOpen={() => {
							if (!canOpenSelectedSession) return;
							router.push(
								getSessionRoute(snapshot.plan.id, selectedSession.id),
							);
						}}
						session={selectedSession}
					/>
				) : (
					<View className="items-center rounded-[28px] bg-card px-5 py-7">
						<Text className="text-center font-poppins font-semibold text-text">
							Keine Lerneinheiten vorhanden
						</Text>
					</View>
				)}
			</View>

			<ScrollView
				className="flex-1 bg-background"
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={[
					{
						paddingHorizontal: 16,
						paddingTop: 18,
						paddingBottom: Math.max(insets.bottom + 36, 54),
					},
					screenContentStyle,
				]}
				showsVerticalScrollIndicator={false}
			>
				{snapshot === null ? (
					<View />
				) : selectedSession ? (
					<LearningPath
						onSelectSession={(session) => setSelectedSessionId(session.id)}
						selectedSessionId={selectedSession.id}
						sessions={snapshot.sessions}
					/>
				) : (
					<View />
				)}
			</ScrollView>
		</Screen>
	);
}
