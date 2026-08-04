import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	FadeIn,
	FadeOut,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import {
	ArrowRight,
	Check,
	Dumbbell,
	GraduationCap,
	Note,
	Repeat,
	Sparkles,
	Time04,
} from "~/components/ui/icon";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import {
	getLearningPathNodePresentation,
	LEARNING_PATH_BREATHING,
	LEARNING_PATH_PHASE_ICON,
	LEARNING_PATH_SEGMENTED_HALO_TONES,
	type LearningPathNodeHalo,
	type LearningPathNodeIcon,
	type LearningPathNodeState,
	type LearningPathNodeTone,
} from "~/features/learning-plans/learning-path-node-presentation";
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
	session,
	onOpen,
}: {
	canOpen: boolean;
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
	const horizonLabel = hasRecordedOutcome
		? "Bearbeitet"
		: session.planningStatus === "provisional"
			? "Danach · Vorschau"
			: "Als Nächstes";
	const content = (
		<View className="gap-2">
			<View className="flex-row">
				<View className="rounded-full bg-system-subtle px-3 py-1.5">
					<Text className="font-poppins font-semibold text-body-5 text-primary">
						{horizonLabel}
					</Text>
				</View>
			</View>
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
			{session.selectionReason ? (
				<Text
					className="font-poppins font-semibold text-body-5 text-primary"
					numberOfLines={2}
				>
					{formatGermanUiText(session.selectionReason)}
				</Text>
			) : null}

			{canOpen ? (
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

const PATH_NODE_STATE_LABEL: Record<LearningPathNodeState, string> = {
	completed: "abgeschlossen",
	current: "verfügbar",
	locked: "adaptive Vorschau",
};

type PathNodeFrame = {
	left: number;
	top: number;
	width: number;
	height: number;
};

const FIGMA_PATH_WIDTH = 345;
const FIGMA_PATH_HEIGHT = 444;
const FIGMA_PATH_CYCLE_HEIGHT = 384;
const FIGMA_FIRST_NODE_FRAME = {
	left: 138.5,
	top: 0,
	width: 68,
	height: 64,
} satisfies PathNodeFrame;
const FIGMA_REPEATING_NODE_FRAMES = [
	{ left: 237, top: 88, width: 100, height: 92 },
	{ left: 138.5, top: 204, width: 68, height: 64 },
	{ left: 24, top: 292, width: 68, height: 64 },
	{ left: 138.5, top: 380, width: 68, height: 64 },
] satisfies PathNodeFrame[];

const getFigmaNodeFrame = (index: number): PathNodeFrame => {
	if (index === 0) return FIGMA_FIRST_NODE_FRAME;

	const repeatingIndex = (index - 1) % FIGMA_REPEATING_NODE_FRAMES.length;
	const cycle = Math.floor((index - 1) / FIGMA_REPEATING_NODE_FRAMES.length);
	const frame =
		FIGMA_REPEATING_NODE_FRAMES[repeatingIndex] ??
		FIGMA_REPEATING_NODE_FRAMES[0];

	return {
		...frame,
		top: frame.top + cycle * FIGMA_PATH_CYCLE_HEIGHT,
	};
};

const getFigmaSegmentPath = (index: number) => {
	const segmentIndex = index % FIGMA_REPEATING_NODE_FRAMES.length;
	const y =
		Math.floor(index / FIGMA_REPEATING_NODE_FRAMES.length) *
		FIGMA_PATH_CYCLE_HEIGHT;

	if (segmentIndex === 0) {
		return `M 206 ${26 + y} H 249 Q 289 ${26 + y} 289 ${66 + y} V ${102 + y}`;
	}
	if (segmentIndex === 1) {
		return `M 289 ${158 + y} V ${194 + y} Q 289 ${234 + y} 249 ${234 + y} H 206`;
	}
	if (segmentIndex === 2) {
		return `M 139 ${230 + y} H 96 Q 56 ${230 + y} 56 ${270 + y} V ${293 + y}`;
	}

	return `M 56 ${348 + y} V ${370 + y} Q 56 ${410 + y} 96 ${410 + y} H 139`;
};

const getFigmaSegmentEndPoint = (index: number) => {
	const segmentIndex = index % FIGMA_REPEATING_NODE_FRAMES.length;
	const cycle = Math.floor(index / FIGMA_REPEATING_NODE_FRAMES.length);
	const cycleOffset = cycle * FIGMA_PATH_CYCLE_HEIGHT;
	const endpoint = [
		{ x: 289, y: 102 },
		{ x: 206, y: 234 },
		{ x: 56, y: 293 },
		{ x: 139, y: 410 },
	][segmentIndex] ?? { x: 139, y: 410 };

	return { x: endpoint.x, y: endpoint.y + cycleOffset };
};

const getFigmaPathHeight = (sessionCount: number) => {
	const lastFrame = getFigmaNodeFrame(Math.max(sessionCount - 1, 0));

	return Math.max(FIGMA_PATH_HEIGHT, lastFrame.top + lastFrame.height + 20);
};

const getActiveSegmentLimit = (sessions: PlanSession[]) => {
	const currentIndex = getCommittedSessionIndex(sessions);
	return currentIndex ?? Math.max(sessions.length - 1, 0);
};

const getPathNodeState = (
	session: PlanSession,
	index: number,
	currentIndex: number | null,
): LearningPathNodeState => {
	if (isLearningPlanSessionHistory(session)) return "completed";
	if (session.planningStatus === "provisional") return "locked";
	if (currentIndex !== null && index === currentIndex) return "current";
	return "locked";
};

const STEP_PUCK_DIMENSIONS = {
	blue: { faceHeight: 52, height: 59, width: 60 },
	gray: { faceHeight: 46, height: 52, width: 52 },
} satisfies Record<
	LearningPathNodeTone,
	{ faceHeight: number; height: number; width: number }
>;
const STEP_PUCK_LIP_OFFSET = 6;
const STEP_SELECTION_WIDTH = 92;
const STEP_SELECTION_HEIGHT = 86;
const STEP_SELECTION_STROKE_WIDTH = 7;
const STEP_HALO_PATH =
	"M46 3.5C69.4721 3.5 88.5 21.1848 88.5 43C88.5 64.8152 69.4721 82.5 46 82.5C22.5279 82.5 3.5 64.8152 3.5 43C3.5 21.1848 22.5279 3.5 46 3.5Z";
const STEP_SEGMENTED_HALO_PATHS = [
	"M40 4C21.8 6.5 7.5 19.5 3.9 36.5",
	"M52 4.1C69.5 6.2 83.5 18.8 87.6 35.2",
	"M88.1 51.2C83.9 68.4 69.3 80.3 52 82",
	"M39.7 81.4C22.1 78.8 8.1 66.2 4 49.8",
] as const;

function StepHalo({
	variant,
}: {
	variant: Exclude<LearningPathNodeHalo, "none">;
}) {
	return (
		<Svg
			pointerEvents="none"
			width={STEP_SELECTION_WIDTH}
			height={STEP_SELECTION_HEIGHT}
			viewBox={`0 0 ${STEP_SELECTION_WIDTH} ${STEP_SELECTION_HEIGHT}`}
			style={{ position: "absolute", left: 0, top: 0 }}
		>
			{variant === "solid" ? (
				<>
					<Path
						d={STEP_HALO_PATH}
						fill="none"
						stroke={DAYOVA_DESIGN_SYSTEM.colors.path4}
						strokeWidth={STEP_SELECTION_STROKE_WIDTH}
					/>
					<Path
						d={STEP_HALO_PATH}
						fill="none"
						stroke={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={3.5}
					/>
				</>
			) : (
				STEP_SEGMENTED_HALO_PATHS.map((path, index) => (
					<Path
						key={path}
						d={path}
						fill="none"
						stroke={
							LEARNING_PATH_SEGMENTED_HALO_TONES[index] === "blue"
								? DAYOVA_DESIGN_SYSTEM.colors.path6
								: DAYOVA_DESIGN_SYSTEM.colors.path1
						}
						strokeLinecap="round"
						strokeWidth={STEP_SELECTION_STROKE_WIDTH}
					/>
				))
			)}
		</Svg>
	);
}

function BreathingStep({
	children,
	enabled,
	left,
	top,
}: {
	children: ReactNode;
	enabled: boolean;
	left: number;
	top: number;
}) {
	const scale = useSharedValue(1);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		cancelAnimation(scale);

		if (!enabled || reduceMotion) {
			scale.set(1);
			return;
		}

		scale.set(
			withRepeat(
				withSequence(
					withTiming(LEARNING_PATH_BREATHING.maxScale, {
						duration: LEARNING_PATH_BREATHING.halfCycleMs,
						easing: Easing.inOut(Easing.sin),
					}),
					withTiming(LEARNING_PATH_BREATHING.minScale, {
						duration: LEARNING_PATH_BREATHING.halfCycleMs,
						easing: Easing.inOut(Easing.sin),
					}),
				),
				-1,
			),
		);

		return () => cancelAnimation(scale);
	}, [enabled, reduceMotion, scale]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.get() }],
	}));

	return (
		<Animated.View
			pointerEvents="none"
			style={[
				{
					position: "absolute",
					left,
					top,
					width: STEP_SELECTION_WIDTH,
					height: STEP_SELECTION_HEIGHT,
					alignItems: "center",
					justifyContent: "center",
				},
				animatedStyle,
			]}
		>
			{children}
		</Animated.View>
	);
}

function StepPuck({
	icon,
	tone,
}: {
	icon: LearningPathNodeIcon;
	tone: LearningPathNodeTone;
}) {
	const isLocked = tone === "gray";
	const Icon = LEARNING_PATH_ICON_COMPONENT[icon];
	const {
		faceHeight,
		height: puckHeight,
		width: puckWidth,
	} = STEP_PUCK_DIMENSIONS[tone];
	const baseColor = isLocked
		? DAYOVA_DESIGN_SYSTEM.colors.pathLockedBase
		: DAYOVA_DESIGN_SYSTEM.colors.path5;
	const faceColor = isLocked
		? DAYOVA_DESIGN_SYSTEM.colors.path1
		: DAYOVA_DESIGN_SYSTEM.colors.path6;
	const iconColor = isLocked
		? DAYOVA_DESIGN_SYSTEM.colors.path3
		: DAYOVA_DESIGN_SYSTEM.colors.light1;

	return (
		<View
			pointerEvents="none"
			style={{
				width: puckWidth,
				height: puckHeight,
				alignItems: "center",
				borderRadius: puckHeight / 2,
				boxShadow: isLocked
					? "0 5px 8px rgba(105, 117, 134, 0.16)"
					: "0 5px 9px rgba(0, 160, 230, 0.2)",
			}}
		>
			<View
				style={{
					position: "absolute",
					top: STEP_PUCK_LIP_OFFSET,
					width: puckWidth,
					height: faceHeight,
					borderRadius: faceHeight / 2,
					backgroundColor: baseColor,
				}}
			/>
			<View
				style={{
					position: "absolute",
					top: 0,
					width: puckWidth,
					height: faceHeight,
					borderRadius: faceHeight / 2,
					backgroundColor: baseColor,
					alignItems: "center",
					justifyContent: "center",
					overflow: "hidden",
				}}
			>
				<View
					style={{
						position: "absolute",
						left: 4,
						top: 3,
						width: puckWidth - 8,
						height: faceHeight - 7,
						borderRadius: (faceHeight - 7) / 2,
						backgroundColor: faceColor,
						overflow: "hidden",
					}}
				>
					<View
						style={{
							position: "absolute",
							top: -9,
							right: isLocked ? -5 : -2,
							width: isLocked ? 17 : 21,
							height: isLocked ? 42 : 48,
							borderRadius: 12,
							backgroundColor: isLocked
								? DAYOVA_DESIGN_SYSTEM.colors.light1
								: DAYOVA_DESIGN_SYSTEM.colors.path7,
							opacity: isLocked ? 0.2 : 0.68,
							transform: [{ rotate: "31deg" }],
						}}
					/>
				</View>
				<Icon
					size={isLocked ? 23 : 28}
					color={iconColor}
					strokeWidth={icon === "check" ? 3.6 : 2.75}
					style={{ zIndex: 1 }}
				/>
			</View>
		</View>
	);
}

function PathNode({
	frame,
	selected,
	session,
	state,
	onPress,
}: {
	frame: PathNodeFrame;
	selected: boolean;
	session: PlanSession;
	state: LearningPathNodeState;
	onPress: () => void;
}) {
	const isLocked = state === "locked";
	const presentation = getLearningPathNodePresentation({
		phase: session.phase,
		selected,
		state,
	});
	const puckDimensions = STEP_PUCK_DIMENSIONS[presentation.tone];
	const title = formatGermanUiText(session.title);
	const stateLabel = PATH_NODE_STATE_LABEL[state];
	const position = {
		left: frame.left,
		top: frame.top,
		width: frame.width,
		height: frame.height,
	} satisfies ViewStyle;

	return (
		<Pressable
			accessibilityLabel={`${title}, ${isDiagnosticLearningPlanSession(session) ? "Wissenscheck" : PHASE_LABEL[session.phase]}, ${session.dateLabel} um ${session.startTime}, ${stateLabel}`}
			accessibilityHint={
				isLocked
					? "Zeigt den voraussichtlich folgenden Lernblock. Er kann sich nach der nächsten Session noch ändern."
					: "Wählt diesen Lernblock aus. Über die Vorschau oben kannst du ihn starten oder ansehen."
			}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			className="absolute items-center justify-center"
			style={position}
		>
			<BreathingStep
				enabled={presentation.motion === "breathe"}
				left={(frame.width - STEP_SELECTION_WIDTH) / 2}
				top={(frame.height - STEP_SELECTION_HEIGHT) / 2}
			>
				{presentation.halo !== "none" ? (
					<StepHalo variant={presentation.halo} />
				) : null}
				<View
					style={{
						position: "absolute",
						left: (STEP_SELECTION_WIDTH - puckDimensions.width) / 2,
						top: (STEP_SELECTION_HEIGHT - puckDimensions.height) / 2,
						zIndex: 1,
					}}
				>
					<StepPuck icon={presentation.icon} tone={presentation.tone} />
				</View>
			</BreathingStep>
		</Pressable>
	);
}

export function LearningPath({
	examCountdownLabel,
	examDateLabel,
	onSelectSession,
	selectedSessionId,
	sessions,
	showsAdaptiveContinuation,
}: {
	examCountdownLabel: string | null;
	examDateLabel: string;
	onSelectSession: (session: PlanSession) => void;
	selectedSessionId: Id<"learningPlanSessions"> | null;
	sessions: PlanSession[];
	showsAdaptiveContinuation: boolean;
}) {
	const currentIndex = getCommittedSessionIndex(sessions);
	const activeSegmentLimit = getActiveSegmentLimit(sessions);
	const continuationSegmentIndex = Math.max(sessions.length - 1, 0);
	const continuationPath = getFigmaSegmentPath(continuationSegmentIndex);
	const continuationEndpoint = getFigmaSegmentEndPoint(
		continuationSegmentIndex,
	);
	const continuationTop = continuationEndpoint.y + 16;
	const basePathHeight = getFigmaPathHeight(sessions.length);
	const pathHeight = showsAdaptiveContinuation
		? Math.max(basePathHeight, continuationTop + 220)
		: basePathHeight;
	const segments = sessions.slice(1).map((_, index) => ({
		d: getFigmaSegmentPath(index),
		active: index < activeSegmentLimit,
	}));

	return (
		<View
			className="relative self-center"
			style={{ width: FIGMA_PATH_WIDTH, height: pathHeight }}
		>
			<Svg
				width={FIGMA_PATH_WIDTH}
				height={pathHeight}
				viewBox={`0 0 ${FIGMA_PATH_WIDTH} ${pathHeight}`}
				style={{ position: "absolute", left: 0, top: 0 }}
			>
				{segments.map((segment) => (
					<Path
						key={`track-${segment.d}`}
						d={segment.d}
						fill="none"
						stroke={DAYOVA_DESIGN_SYSTEM.colors.path1}
						strokeWidth={4}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				))}
				{segments
					.filter((segment) => segment.active)
					.map((segment) => (
						<Path
							key={`active-${segment.d}`}
							d={segment.d}
							fill="none"
							stroke={DAYOVA_DESIGN_SYSTEM.colors.primary}
							strokeWidth={4}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					))}
				{showsAdaptiveContinuation ? (
					<Path
						d={continuationPath}
						fill="none"
						opacity={0.72}
						stroke={DAYOVA_DESIGN_SYSTEM.colors.primary}
						strokeDasharray="7 9"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={4}
						testID="adaptive-continuation-path"
					/>
				) : null}
			</Svg>

			{showsAdaptiveContinuation ? (
				<View
					accessible={false}
					className="absolute h-3 w-3 rounded-full border-2 border-background bg-primary"
					pointerEvents="none"
					// The marker is centered on the generated continuation endpoint.
					style={{
						left: continuationEndpoint.x - 6,
						top: continuationEndpoint.y - 6,
					}}
					testID="adaptive-continuation-endpoint"
				/>
			) : null}

			{sessions.map((session, index) => {
				const state = getPathNodeState(session, index, currentIndex);

				return (
					<PathNode
						key={session.id}
						frame={getFigmaNodeFrame(index)}
						selected={session.id === selectedSessionId}
						session={session}
						state={state}
						onPress={() => onSelectSession(session)}
					/>
				);
			})}

			{showsAdaptiveContinuation ? (
				<View
					accessible
					accessibilityLabel={`Dayova plant mit dir weiter. Nach deinem Abschluss passt Dayova die Vorschau an und plant den nächsten Termin. Prüfung am ${examDateLabel}${examCountdownLabel ? `, ${examCountdownLabel}` : ""}.`}
					className="absolute right-2 left-2 gap-4 overflow-hidden rounded-card border border-primary/20 bg-system-subtle px-4 py-4"
					// The card is positioned against the generated path geometry; the
					// continuous curve has no NativeWind utility.
					style={{ top: continuationTop, borderCurve: "continuous" }}
					testID="adaptive-continuation-card"
				>
					<View className="flex-row items-start gap-3">
						<View className="h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-primary">
							<Sparkles
								size={19}
								color={DAYOVA_DESIGN_SYSTEM.colors.light1}
								strokeWidth={2.1}
							/>
						</View>
						<View className="min-w-0 flex-1">
							<Text className="font-poppins font-semibold text-body-3 text-text">
								Dayova plant mit dir weiter
							</Text>
							<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
								Nach deinem Abschluss passt Dayova die Vorschau an und plant den
								nächsten Termin.
							</Text>
						</View>
					</View>

					<View className="h-px bg-primary/15" />

					<View className="flex-row items-center gap-3">
						<View className="h-9 w-9 items-center justify-center rounded-[14px] bg-card">
							<GraduationCap
								size={18}
								color={DAYOVA_DESIGN_SYSTEM.colors.primary}
								strokeWidth={2.1}
							/>
						</View>
						<View className="min-w-0 flex-1">
							<Text className="font-poppins font-semibold text-body-5 text-primary">
								Prüfung
							</Text>
							<Text
								className="font-poppins text-body-4 text-text"
								numberOfLines={1}
							>
								{examDateLabel}
							</Text>
						</View>
						{examCountdownLabel ? (
							<View className="shrink-0 rounded-full bg-card px-3 py-2">
								<Text className="font-poppins font-semibold text-body-5 text-primary">
									{examCountdownLabel}
								</Text>
							</View>
						) : null}
					</View>
				</View>
			) : null}
		</View>
	);
}

export default function LearningPlanSessionsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const today = useCurrentLocalDay();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuthSession();
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
			? getPathNodeState(
					selectedSession,
					selectedSessionIndex,
					getCommittedSessionIndex(snapshot.sessions),
				)
			: null;
	const canOpenSelectedSession =
		selectedSessionState !== null &&
		selectedSessionState !== "locked" &&
		selectedSession?.planningStatus !== "provisional";

	useEffect(() => {
		if (
			!defaultSession ||
			defaultSession.contentGenerationStatus === "ready" ||
			preparingSessionIdRef.current === defaultSession.id
		) {
			return;
		}

		preparingSessionIdRef.current = defaultSession.id;
		void ensureSessionContent({ sessionId: defaultSession.id })
			.catch(() => {
				// The session route owns the user-facing retry state. This is only
				// an eager preparation attempt when a session becomes current.
			})
			.finally(() => {
				if (preparingSessionIdRef.current === defaultSession.id) {
					preparingSessionIdRef.current = null;
				}
			});
	}, [defaultSession, ensureSessionContent]);

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
						session={selectedSession}
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
					<LearningPath
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
						onSelectSession={(session) => setSelectedSessionId(session.id)}
					/>
				) : (
					<View />
				)}
			</ScrollView>
		</Screen>
	);
}
