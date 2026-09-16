import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import {
	ArrowRight,
	Check,
	CircleAlert,
	Dumbbell,
	Note,
	Repeat,
	Sparkles,
	Time04,
} from "~/components/ui/icon";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAiConsent } from "~/context/AiConsentContext";
import { useAuthSession } from "~/context/AuthContext";
import {
	LEARNING_PATH_PHASE_ICON,
	type LearningPathNodeIcon,
} from "~/features/learning-plans/learning-path-node-presentation";
import {
	getLearningPathNodeState,
	LearningPathVisual,
} from "~/features/learning-plans/learning-path-visual";
import {
	getCommittedSessionIndex,
	getDefaultLearningPlanSession,
	isDiagnosticLearningPlanSession,
	isLearningPlanSessionHistory,
} from "~/features/learning-plans/rolling-learning-window";
import type {
	LearningPlanSnapshot,
	PlanSession,
} from "~/features/learning-plans/types";
import { parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { dismissToOrReplace } from "~/lib/navigation";
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

const LEARNING_PATH_ICON_COMPONENT = {
	check: Check,
	dumbbell: Dumbbell,
	note: Note,
	repeat: Repeat,
} satisfies Record<LearningPathNodeIcon, typeof Dumbbell>;

const screenContentStyle = { rowGap: 28 } satisfies ViewStyle;
const SESSION_PREVIEW_TRANSITION_DURATION_MS = 160;
const CURRENT_THEORY_CONTENT_VERSION = 2;

export const getExamCountdownLabel = (examDateKey: string, today: Date) => {
	const examDate = parseDayKey(examDateKey);
	if (!examDate) return null;

	const remainingDays = Math.round(
		(examDate.getTime() - today.getTime()) / 86_400_000,
	);

	if (remainingDays < 0) return "Prüfung vorbei";
	if (remainingDays === 0) return "Heute";
	if (remainingDays === 1) return "Noch 1 Tag";
	return `Noch ${remainingDays} Tage`;
};

const getSessionRoute = (
	planId: Id<"learningPlans">,
	sessionId: Id<"learningPlanSessions">,
) => `/learning-plans/${planId}/sessions/${sessionId}` as const;

export function SessionPreviewCard({
	canOpen,
	onRetryPreparation,
	preparationState,
	session,
	onOpen,
}: {
	canOpen: boolean;
	onRetryPreparation?: () => void;
	preparationState?: "preparing" | "failed";
	session: PlanSession;
	onOpen: () => void;
}) {
	const { colors } = useDayovaTheme();
	const reduceMotion = useReducedMotion();
	const phase = PHASE_COLOR[session.phase];
	const sessionTypeLabel = isDiagnosticLearningPlanSession(session)
		? "Wissenscheck"
		: PHASE_LABEL[session.phase];
	const PhaseIcon =
		LEARNING_PATH_ICON_COMPONENT[LEARNING_PATH_PHASE_ICON[session.phase]];
	const title = formatGermanUiText(session.title);
	const description = formatGermanUiText(session.goal);
	const hasRecordedOutcome = isLearningPlanSessionHistory(session);
	const actionLabel = hasRecordedOutcome
		? "Lernsession ansehen"
		: session.executionStatus === "started"
			? "Weiterlernen"
			: "Lernsession starten";
	const content = (
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
							{sessionTypeLabel}
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
					{session.dateLabel} · {session.startTime}
				</Text>
			</View>

			<Text
				className="font-poppins text-body-4 text-secondary-text"
				numberOfLines={2}
			>
				{description}
			</Text>
			{preparationState === "preparing" ? (
				<View
					accessible
					accessibilityLiveRegion="polite"
					className="mt-1 flex-row items-center gap-3 rounded-[20px] bg-system-subtle px-3 py-3"
				>
					<ActivityIndicator
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						size="small"
					/>
					<View className="min-w-0 flex-1">
						<Text className="font-poppins font-semibold text-body-5 text-text">
							Lerninhalte werden vorbereitet
						</Text>
						<Text className="mt-0.5 font-poppins text-body-5 text-secondary-text">
							Du kannst den Plan verlassen. Dayova arbeitet im Hintergrund
							weiter.
						</Text>
					</View>
				</View>
			) : preparationState === "failed" ? (
				<View className="mt-1 gap-3 rounded-[20px] bg-wrong-subtle px-3 py-3">
					<View className="flex-row items-start gap-2">
						<CircleAlert
							size={17}
							color={DAYOVA_DESIGN_SYSTEM.colors.wrong}
							strokeWidth={2.1}
						/>
						<Text className="min-w-0 flex-1 font-poppins text-body-5 text-secondary-text">
							Die Lerninhalte konnten noch nicht vorbereitet werden.
						</Text>
					</View>
					<Button
						accessibilityLabel={`Vorbereitung erneut versuchen: ${title}`}
						onPress={onRetryPreparation}
						size="sm"
						variant="neutral"
					>
						<Text>Erneut versuchen</Text>
					</Button>
				</View>
			) : canOpen ? (
				<Button
					accessibilityHint="Öffnet die ausgewählte Lerneinheit."
					accessibilityLabel={`${actionLabel}: ${title}`}
					className="mt-1 w-full"
					onPress={onOpen}
					size="sm"
				>
					<Text>{actionLabel}</Text>
					<ArrowRight
						size={18}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2.2}
					/>
				</Button>
			) : (
				<View className="mt-1 flex-row items-start gap-2 rounded-[20px] bg-system-subtle px-3 py-3">
					<Sparkles
						size={16}
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						strokeWidth={2.1}
					/>
					<Text className="min-w-0 flex-1 font-poppins text-body-5 text-secondary-text">
						Diese Vorschau kann sich nach deinem nächsten Abschluss ändern.
					</Text>
				</View>
			)}
		</View>
	);

	return (
		<Animated.View
			entering={
				reduceMotion
					? undefined
					: FadeIn.duration(SESSION_PREVIEW_TRANSITION_DURATION_MS)
			}
			exiting={
				reduceMotion
					? undefined
					: FadeOut.duration(SESSION_PREVIEW_TRANSITION_DURATION_MS)
			}
			className="w-full rounded-card border border-border bg-card px-4 py-4"
			// React Native's continuous corner curve has no NativeWind utility.
			style={{ borderCurve: "continuous" }}
		>
			{content}
		</Animated.View>
	);
}

export default function LearningPlanSessionsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const today = useCurrentLocalDay();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { requestAiConsent } = useAiConsent();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const ensureSessionContent = useAction(
		api.learningPlanAi.ensureSessionContent,
	);
	const preparingSessionIdRef = useRef<Id<"learningPlanSessions"> | null>(null);
	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const [selectedSessionId, setSelectedSessionId] =
		useState<Id<"learningPlanSessions"> | null>(null);
	const defaultSession = snapshot
		? getDefaultLearningPlanSession(snapshot.sessions)
		: null;
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
					getCommittedSessionIndex(snapshot.sessions),
				)
			: null;
	const selectedSessionNeedsTheoryUpgrade = Boolean(
		selectedSession &&
			selectedSession.phase === "theory" &&
			selectedSession.executionStatus === "notStarted" &&
			(selectedSession.contentGenerationVersion ?? 0) <
				CURRENT_THEORY_CONTENT_VERSION,
	);
	const canOpenSelectedSession =
		selectedSessionState !== null &&
		selectedSessionState !== "locked" &&
		selectedSession?.planningStatus !== "provisional" &&
		!selectedSessionNeedsTheoryUpgrade &&
		(selectedSession?.contentGenerationStatus === undefined ||
			selectedSession.contentGenerationStatus === "ready");
	const preparationState =
		selectedSession?.contentGenerationStatus === "failed"
			? ("failed" as const)
			: selectedSessionNeedsTheoryUpgrade ||
					selectedSession?.contentGenerationStatus === "queued" ||
					selectedSession?.contentGenerationStatus === "generating"
				? ("preparing" as const)
				: undefined;

	const prepareSession = useCallback(
		(sessionId: Id<"learningPlanSessions">) => {
			if (preparingSessionIdRef.current === sessionId) return;
			preparingSessionIdRef.current = sessionId;
			void requestAiConsent()
				.then((allowed) =>
					allowed ? ensureSessionContent({ sessionId }) : undefined,
				)
				.catch(() => {
					// The reactive session status drives the retry presentation.
				})
				.finally(() => {
					if (preparingSessionIdRef.current === sessionId) {
						preparingSessionIdRef.current = null;
					}
				});
		},
		[ensureSessionContent, requestAiConsent],
	);

	useEffect(() => {
		const needsTheoryUpgrade = Boolean(
			defaultSession &&
				defaultSession.phase === "theory" &&
				defaultSession.executionStatus === "notStarted" &&
				(defaultSession.contentGenerationVersion ?? 0) <
					CURRENT_THEORY_CONTENT_VERSION,
		);
		if (
			!defaultSession ||
			(defaultSession.contentGenerationStatus === "ready" &&
				!needsTheoryUpgrade) ||
			defaultSession.contentGenerationStatus === "failed"
		) {
			return;
		}
		prepareSession(defaultSession.id);
	}, [defaultSession, prepareSession]);

	const goBack = () => {
		dismissToOrReplace(router, "/learning-plans");
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
					title="Lernplan"
					onBack={goBack}
					className="mb-0"
					titleClassName="text-center font-poppins font-semibold text-heading-2 text-text"
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
						key={selectedSession.id}
						canOpen={canOpenSelectedSession}
						preparationState={preparationState}
						session={selectedSession}
						onRetryPreparation={() => prepareSession(selectedSession.id)}
						onOpen={() => {
							if (!canOpenSelectedSession) return;
							router.push(
								getSessionRoute(snapshot.plan.id, selectedSession.id),
							);
						}}
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
					<LearningPathVisual
						mode="screen"
						examCountdownLabel={getExamCountdownLabel(
							snapshot.plan.examDateKey,
							today,
						)}
						examDateLabel={snapshot.plan.examDateLabel}
						selectedSessionId={selectedSession.id}
						sessions={snapshot.sessions}
						showsAdaptiveContinuation={
							snapshot.plan.rollingPlanEnabled === true
						}
						onOpenSession={(session) => {
							if (
								!canOpenSelectedSession ||
								session.id !== selectedSession.id
							) {
								return;
							}
							router.push(getSessionRoute(snapshot.plan.id, session.id));
						}}
						onSelectSession={(session) => setSelectedSessionId(session.id)}
					/>
				) : (
					<View />
				)}
			</ScrollView>
		</Screen>
	);
}
