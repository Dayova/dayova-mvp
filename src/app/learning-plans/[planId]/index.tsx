import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Check, CircleAlert, Clock3, Route2 } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/context/AuthContext";
import { SESSION_EXECUTION_STATUS_LABEL } from "~/features/learning-plans/constants";
import type {
	LearningPlanSnapshot,
	MissedReason,
	PlanSession,
} from "~/features/learning-plans/types";
import {
	getErrorMessage,
	minutesFromTime,
	timeFromMinutes,
} from "~/features/learning-plans/utils";
import { useValidationAnalytics } from "~/lib/analytics";
import { definedAnalyticsProperties } from "~/lib/analytics-core";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { goBackOrReplace } from "~/lib/navigation";

const PHASE_LABEL: Record<PlanSession["phase"], string> = {
	theory: "Theorie",
	practice: "Üben",
	rehearsal: "Testmodus",
};

const MISSED_REASON_OPTIONS: MissedReason[] = [
	"no_time",
	"forgot",
	"no_motivation",
	"too_hard",
	"too_big",
	"unclear",
	"other",
];

const MISSED_REASON_LABEL: Record<MissedReason, string> = {
	no_time: "Keine Zeit",
	forgot: "Vergessen",
	no_motivation: "Keine Motivation",
	too_hard: "Zu schwer",
	too_big: "Zu groß",
	unclear: "Unklar",
	other: "Anderer Grund",
};

type LearningSessionEventPayload = {
	learningPlanId: Id<"learningPlans">;
	learningPlanSessionId: Id<"learningPlanSessions">;
	phase: PlanSession["phase"];
	plannedDayKey: string;
	startTime: string;
	durationMinutes: number;
	subject: string;
	examTypeLabel: string;
	examDateKey: string;
};

const learningSessionAnalyticsProperties = (
	payload: LearningSessionEventPayload,
) =>
	definedAnalyticsProperties({
		learning_plan_id: payload.learningPlanId,
		learning_plan_session_id: payload.learningPlanSessionId,
		phase: payload.phase,
		planned_day_key: payload.plannedDayKey,
		start_time: payload.startTime,
		duration_minutes: payload.durationMinutes,
		subject: payload.subject,
		exam_type_label: payload.examTypeLabel,
		exam_date_key: payload.examDateKey,
	});

function SessionActionButton({
	label,
	variant = "primary",
	disabled,
	loading,
	onPress,
}: {
	label: string;
	variant?: "primary" | "secondary" | "danger" | "muted";
	disabled?: boolean;
	loading?: boolean;
	onPress: () => void;
}) {
	const styleByVariant = {
		primary: { backgroundColor: "#3A7BFF", color: "#FFFFFF" },
		secondary: { backgroundColor: "#EEF4FF", color: "#3A7BFF" },
		danger: { backgroundColor: "#FFF1F2", color: "#E11D48" },
		muted: { backgroundColor: "#E8EAEE", color: "#1A1A1A" },
	}[variant];

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: Boolean(disabled || loading) }}
			activeOpacity={0.84}
			disabled={disabled || loading}
			onPress={onPress}
			className="min-h-[44px] flex-1 flex-row items-center justify-center rounded-full px-4 py-3"
			style={{
				backgroundColor: styleByVariant.backgroundColor,
				gap: 8,
				minWidth: 124,
				opacity: disabled ? 0.58 : 1,
			}}
		>
			{loading ? <ActivityIndicator color={styleByVariant.color} /> : null}
			<Text
				className="text-center font-poppins font-semibold"
				style={{
					color: styleByVariant.color,
					fontSize: 13,
					lineHeight: 18,
					includeFontPadding: false,
				}}
			>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

function SessionOverviewCard({
	session,
	isPending,
	errorMessage,
	onStart,
	onRecordOutcome,
	onMiss,
	onAdjust,
}: {
	session: PlanSession;
	isPending: boolean;
	errorMessage?: string;
	onStart: (session: PlanSession) => void;
	onRecordOutcome: (
		session: PlanSession,
		outcome: "completed" | "partiallyCompleted",
	) => void;
	onMiss: (session: PlanSession, reason: MissedReason) => void;
	onAdjust: (session: PlanSession) => void;
}) {
	const [showMissReasons, setShowMissReasons] = useState(false);
	const endTime = timeFromMinutes(
		minutesFromTime(session.startTime) + session.durationMinutes,
	);
	const status = session.executionStatus;
	const isOutcomeSaved =
		status === "completed" ||
		status === "partiallyCompleted" ||
		status === "adjusted";

	const title = formatGermanUiText(session.title);
	const goal = formatGermanUiText(session.goal);

	return (
		<Surface className="rounded-[28px] px-5 py-5" style={{ rowGap: 14 }}>
			<View
				className="flex-row items-start justify-between"
				style={{ gap: 14 }}
			>
				<View className="flex-1">
					<Text
						className="font-poppins font-semibold text-[#202127]"
						style={{ fontSize: 16, lineHeight: 21, includeFontPadding: false }}
					>
						{title}
					</Text>
					<Text
						className="mt-2 font-poppins text-[#8D8F98]"
						style={{ fontSize: 12, lineHeight: 17, includeFontPadding: false }}
					>
						{PHASE_LABEL[session.phase]}
					</Text>
				</View>
				<View className="items-end" style={{ rowGap: 8 }}>
					<View className="rounded-full bg-[#EEF4FF] px-3 py-2">
						<Text
							className="font-poppins font-semibold text-[#3A7BFF]"
							style={{ fontSize: 12, lineHeight: 15, includeFontPadding: false }}
						>
							{`${session.durationMinutes} Min.`}
						</Text>
					</View>
					<View className="rounded-full bg-[#F2F3F6] px-3 py-2">
						<Text
							className="font-poppins font-semibold text-[#6F727C]"
							style={{ fontSize: 11, lineHeight: 14, includeFontPadding: false }}
						>
							{SESSION_EXECUTION_STATUS_LABEL[status]}
						</Text>
					</View>
				</View>
			</View>

			<View className="flex-row items-center" style={{ columnGap: 8 }}>
				<Clock3 size={16} color="#9A9DA8" strokeWidth={2.1} />
				<Text
					className="font-poppins text-[#6F727C]"
					style={{ fontSize: 13, lineHeight: 18, includeFontPadding: false }}
				>
					{`${session.dateLabel} · ${session.startTime} - ${endTime}`}
				</Text>
			</View>

			<Text
				className="font-poppins text-[#6F727C]"
				style={{ fontSize: 13, lineHeight: 19, includeFontPadding: false }}
			>
				{goal}
			</Text>

			{session.missedReason ? (
				<Text
					className="font-poppins text-[#8D4B1F]"
					style={{ fontSize: 12, lineHeight: 17, includeFontPadding: false }}
				>
					{`Grund: ${MISSED_REASON_LABEL[session.missedReason]}`}
				</Text>
			) : null}

			{errorMessage ? (
				<Text
					className="font-poppins text-destructive"
					style={{ fontSize: 12, lineHeight: 17, includeFontPadding: false }}
				>
					{errorMessage}
				</Text>
			) : null}

			<View className="mt-1" style={{ rowGap: 10 }}>
				{status === "notStarted" ? (
					<View className="flex-row flex-wrap" style={{ gap: 10 }}>
						<SessionActionButton
							label="Starten"
							loading={isPending}
							onPress={() => onStart(session)}
						/>
						<SessionActionButton
							label="Verpasst"
							variant="danger"
							disabled={isPending}
							onPress={() => setShowMissReasons((value) => !value)}
						/>
					</View>
				) : null}

				{status === "started" ? (
					<View className="flex-row flex-wrap" style={{ gap: 10 }}>
						<SessionActionButton
							label="Erledigt"
							loading={isPending}
							onPress={() => onRecordOutcome(session, "completed")}
						/>
						<SessionActionButton
							label="Teilweise"
							variant="secondary"
							disabled={isPending}
							onPress={() => onRecordOutcome(session, "partiallyCompleted")}
						/>
						<SessionActionButton
							label="Verpasst"
							variant="danger"
							disabled={isPending}
							onPress={() => setShowMissReasons((value) => !value)}
						/>
					</View>
				) : null}

				{showMissReasons ? (
					<View className="rounded-[22px] bg-[#FAFAFB] p-3" style={{ rowGap: 10 }}>
						<Text
							className="font-poppins font-semibold text-[#4F535E]"
							style={{ fontSize: 12, lineHeight: 16, includeFontPadding: false }}
						>
							Warum hat es nicht geklappt?
						</Text>
						<View className="flex-row flex-wrap" style={{ gap: 8 }}>
							{MISSED_REASON_OPTIONS.map((reason) => (
								<TouchableOpacity
									key={reason}
									accessibilityRole="button"
									accessibilityLabel={MISSED_REASON_LABEL[reason]}
									activeOpacity={0.82}
									disabled={isPending}
									onPress={() => {
										setShowMissReasons(false);
										onMiss(session, reason);
									}}
									className="rounded-full bg-white px-3 py-2"
									style={{ opacity: isPending ? 0.58 : 1 }}
								>
									<Text
										className="font-poppins font-semibold text-[#4F535E]"
										style={{
											fontSize: 12,
											lineHeight: 16,
											includeFontPadding: false,
										}}
									>
										{MISSED_REASON_LABEL[reason]}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
				) : null}

				{status === "missed" ? (
					<SessionActionButton
						label="Kleiner neu planen"
						variant="secondary"
						loading={isPending}
						onPress={() => onAdjust(session)}
					/>
				) : null}

				{isOutcomeSaved ? (
					<View className="flex-row items-center" style={{ gap: 8 }}>
						<Check size={16} color="#2E7D32" strokeWidth={2.2} />
						<Text
							className="font-poppins font-semibold text-[#2E7D32]"
							style={{ fontSize: 12, lineHeight: 17, includeFontPadding: false }}
						>
							Ergebnis gespeichert
						</Text>
					</View>
				) : null}
			</View>
		</Surface>
	);
}

export default function LearningPlanSessionsScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const startSession = useMutation(api.learningPlans.startSession);
	const recordSessionOutcome = useMutation(api.learningPlans.recordSessionOutcome);
	const missSession = useMutation(api.learningPlans.missSession);
	const adjustMissedSession = useMutation(api.learningPlans.adjustMissedSession);
	const { capture } = useValidationAnalytics();
	const [pendingSessionId, setPendingSessionId] =
		useState<Id<"learningPlanSessions"> | null>(null);
	const [sessionErrors, setSessionErrors] = useState<
		Partial<Record<Id<"learningPlanSessions">, string>>
	>({});
	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const title = snapshot
		? formatGermanUiText(
				`${snapshot.plan.subject} ${snapshot.plan.examTypeLabel}`.trim(),
			)
		: "Lernplan";

	const goBack = () => {
		goBackOrReplace(router, "/learning-plans");
	};

	const runSessionAction = async (
		session: PlanSession,
		fallbackMessage: string,
		task: () => Promise<void>,
	) => {
		if (pendingSessionId) return;

		setPendingSessionId(session.id);
		setSessionErrors((current) => ({ ...current, [session.id]: undefined }));
		try {
			await task();
		} catch (error) {
			setSessionErrors((current) => ({
				...current,
				[session.id]: getErrorMessage(error, fallbackMessage),
			}));
		} finally {
			setPendingSessionId(null);
		}
	};

	const handleStartSession = (session: PlanSession) => {
		void runSessionAction(
			session,
			"Der Lernblock konnte nicht gestartet werden.",
			async () => {
				const result = await startSession({ sessionId: session.id });
				void capture(
					"study_slot_started",
					definedAnalyticsProperties({
						...learningSessionAnalyticsProperties(result),
						started_at: result.startedAt,
					}),
				);
			},
		);
	};

	const handleRecordOutcome = (
		session: PlanSession,
		outcome: "completed" | "partiallyCompleted",
	) => {
		void runSessionAction(
			session,
			"Das Ergebnis konnte nicht gespeichert werden.",
			async () => {
				const result = await recordSessionOutcome({
					sessionId: session.id,
					outcome,
				});
				const properties = definedAnalyticsProperties({
					...learningSessionAnalyticsProperties(result),
					outcome,
					outcome_at: result.outcomeAt,
				});
				void capture(
					outcome === "completed"
						? "study_slot_completed"
						: "study_slot_partially_completed",
					properties,
				);
				if (outcome === "completed" && result.phase === "rehearsal") {
					void capture("generalprobe_completed", properties);
				}
			},
		);
	};

	const handleMissSession = (session: PlanSession, reason: MissedReason) => {
		void runSessionAction(
			session,
			"Der Grund konnte nicht gespeichert werden.",
			async () => {
				const result = await missSession({
					sessionId: session.id,
					reason,
				});
				const properties = definedAnalyticsProperties({
					...learningSessionAnalyticsProperties(result),
					missed_reason: reason,
					outcome_at: result.outcomeAt,
				});
				void capture("study_slot_missed", properties);
				void capture("missed_reason_selected", properties);
			},
		);
	};

	const handleAdjustSession = (session: PlanSession) => {
		void runSessionAction(
			session,
			"Der Lernblock konnte nicht neu geplant werden.",
			async () => {
				const result = await adjustMissedSession({
					sessionId: session.id,
					dateKey: session.dateKey,
					dateLabel: session.dateLabel,
					startTime: timeFromMinutes(
						Math.min(
							minutesFromTime(session.startTime) + session.durationMinutes,
							22 * 60,
						),
					),
					durationMinutes: Math.max(
						15,
						Math.floor(session.durationMinutes / 2),
					),
				});
				void capture(
					"plan_adjusted",
					definedAnalyticsProperties({
						...learningSessionAnalyticsProperties(result),
						new_learning_plan_session_id: result.newLearningPlanSessionId,
						old_date_key: result.oldDateKey,
						new_date_key: result.newDateKey,
						old_duration_minutes: result.oldDurationMinutes,
						new_duration_minutes: result.newDurationMinutes,
						missed_reason: result.missedReason,
						adjusted_at: result.adjustedAt,
					}),
				);
			},
		);
	};

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScreenScroll
				contentInsetAdjustmentBehavior="automatic"
				horizontalPadding={24}
				topPadding={46}
				bottomPadding={120}
				contentContainerStyle={{ rowGap: 24 }}
			>
				<ScreenHeader title="Lernplan" onBack={goBack} className="mb-0" />

				<Surface className="rounded-[34px] px-5 py-6">
					<View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-[#FFEAF8]">
						<Route2 size={27} color="#FF42C8" strokeWidth={2.2} />
					</View>
					<Text
						className="font-bold font-poppins text-[#202127]"
						style={{ fontSize: 25, lineHeight: 30, includeFontPadding: false }}
					>
						{title}
					</Text>
					<Text
						className="mt-2 font-poppins text-[#8D8F98]"
						style={{ fontSize: 13, lineHeight: 19, includeFontPadding: false }}
					>
						{snapshot
							? `${snapshot.sessions.length} ${
									snapshot.sessions.length === 1
										? "Lerneinheit"
										: "Lerneinheiten"
								}`
							: "Lerneinheiten werden geladen"}
					</Text>
				</Surface>

				{snapshot?.plan.planningHint ? (
					<Surface
						className="flex-row rounded-[24px] px-5 py-4"
						style={{ gap: 12 }}
					>
						<CircleAlert size={20} color="#F59E0B" strokeWidth={2.2} />
						<Text
							className="flex-1 font-poppins text-[#7A5A12]"
							style={{
								fontSize: 13,
								lineHeight: 19,
								includeFontPadding: false,
							}}
						>
							{snapshot.plan.planningHint}
						</Text>
					</Surface>
				) : null}

				<View style={{ rowGap: 14 }}>
					{snapshot?.sessions.map((session) => (
						<SessionOverviewCard
							key={session.id}
							session={session}
							isPending={pendingSessionId === session.id}
							errorMessage={sessionErrors[session.id]}
							onStart={handleStartSession}
							onRecordOutcome={handleRecordOutcome}
							onMiss={handleMissSession}
							onAdjust={handleAdjustSession}
						/>
					))}
				</View>

				{snapshot && snapshot.sessions.length === 0 ? (
					<View className="items-center rounded-[28px] bg-white px-5 py-7">
						<Text className="text-center font-poppins font-semibold text-[#202127]">
							Keine Lerneinheiten vorhanden
						</Text>
					</View>
				) : null}
			</ScreenScroll>
		</Screen>
	);
}
