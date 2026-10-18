import { SessionPreviewCard } from "~/features/learning-plans/session-preview-card";

export { SessionPreviewCard } from "~/features/learning-plans/session-preview-card";

import { useAction, useConvexAuth, useQuery } from "convex/react";
import {
	Stack,
	useFocusEffect,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAiConsent } from "~/context/AiConsentContext";
import { useAuthSession } from "~/context/AuthContext";
import { ExtraPracticeCard } from "~/features/learning-plans/extra-practice-card";
import {
	getLearningPathNodeState,
	LearningPathVisual,
} from "~/features/learning-plans/learning-path-visual";
import {
	getCommittedSessionIndex,
	getDefaultLearningPlanSession,
} from "~/features/learning-plans/rolling-learning-window";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { dismissToOrReplace } from "~/lib/navigation";
import { getSafeReturnTo, ROUTES } from "~/lib/routes";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";

const screenContentStyle = { rowGap: 28 } satisfies ViewStyle;
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

export default function LearningPlanSessionsScreen() {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const today = useCurrentLocalDay();
	const params = useLocalSearchParams<{ planId?: string; returnTo?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
	const { requestAiConsent } = useAiConsent();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const ensureSessionContent = useAction(
		api.learningPlanAi.ensureSessionContent,
	);
	const preparingSessionIdRef = useRef<Id<"learningPlanSessions"> | null>(null);
	const trackFeatureRef = useRef(trackFeature);
	useEffect(() => {
		trackFeatureRef.current = trackFeature;
	}, [trackFeature]);
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
	const visiblePlanId =
		snapshot && snapshot.sessions.length > 0 ? snapshot.plan.id : undefined;
	useFocusEffect(
		useCallback(() => {
			if (visiblePlanId)
				trackFeatureRef.current(
					"learning_plan.content_viewed",
					"performed",
					visiblePlanId,
				);
		}, [visiblePlanId]),
	);
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

	useEffect(() => {
		if (snapshot?.plan.preparationState === "review" && planId)
			router.replace(`/learning-plans/${planId}/preparation`);
	}, [snapshot?.plan.preparationState, planId, router]);
	const goBack = () => {
		dismissToOrReplace(
			router,
			getSafeReturnTo(params.returnTo) ?? ROUTES.learningPlans,
		);
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

			{snapshot?.plan.preparationState === "ready" ? (
				<View className="px-4 pb-3">
					<Button
						variant="outline"
						onPress={() => router.push(`/learning-plans/${planId}/preparation`)}
					>
						<Text>Termine</Text>
					</Button>
				</View>
			) : null}
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
							snapshot.plan.rollingPlanEnabled === true &&
							!snapshot.plan.preparationState
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
						onSelectSession={(session) => {
							trackFeature(
								"learning_plan.session_selected",
								"performed",
								session.id,
							);
							setSelectedSessionId(session.id);
						}}
					/>
				) : (
					<View />
				)}
				{snapshot?.plan.preparationState === "completed" ? (
					<ExtraPracticeCard
						planId={snapshot.plan.id}
						topics={snapshot.plan.topicMap}
					/>
				) : null}
			</ScrollView>
		</Screen>
	);
}
