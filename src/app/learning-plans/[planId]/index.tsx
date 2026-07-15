import { useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
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
import {
	ArrowUpRight,
	Check,
	Dumbbell,
	Note,
	Repeat,
	Time04,
} from "~/components/ui/icon";
import { CompactNotchedActionCard } from "~/components/ui/notched-action-card";
import { Screen } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import {
	getLearningPathNodePresentation,
	LEARNING_PATH_BREATHING,
	LEARNING_PATH_PHASE_ICON,
	type LearningPathNodeHalo,
	type LearningPathNodeIcon,
	type LearningPathNodeState,
	type LearningPathNodeTone,
} from "~/features/learning-plans/learning-path-node-presentation";
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

const LEARNING_PATH_ICON_COMPONENT = {
	check: Check,
	dumbbell: Dumbbell,
	note: Note,
	repeat: Repeat,
} satisfies Record<LearningPathNodeIcon, typeof Dumbbell>;

const screenContentStyle = { rowGap: 28 } satisfies ViewStyle;
const SESSION_PREVIEW_CARD_HEIGHT = 174;

const getSessionRoute = (
	planId: Id<"learningPlans">,
	sessionId: Id<"learningPlanSessions">,
) => `/learning-plans/${planId}/sessions/${sessionId}` as const;

function SessionPreviewCard({
	canOpen,
	session,
	onOpen,
}: {
	canOpen: boolean;
	session: PlanSession;
	onOpen: () => void;
}) {
	const { colors } = useDayovaTheme();
	const phase = PHASE_COLOR[session.phase];
	const PhaseIcon =
		LEARNING_PATH_ICON_COMPONENT[LEARNING_PATH_PHASE_ICON[session.phase]];
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
			onPress={onOpen}
			pressType="action"
			cardHeight={SESSION_PREVIEW_CARD_HEIGHT}
			cardStyle={{
				paddingTop: 22,
				paddingBottom: 24,
			}}
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

const PATH_NODE_STATE_LABEL: Record<LearningPathNodeState, string> = {
	completed: "abgeschlossen",
	current: "verfügbar",
	locked: "gesperrt",
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

const getFigmaPathHeight = (sessionCount: number) => {
	const lastFrame = getFigmaNodeFrame(Math.max(sessionCount - 1, 0));

	return Math.max(FIGMA_PATH_HEIGHT, lastFrame.top + lastFrame.height + 20);
};

const getCurrentSessionIndex = (sessions: PlanSession[]) => {
	const firstOpenIndex = sessions.findIndex((session) => !session.completed);
	return firstOpenIndex === -1 ? null : firstOpenIndex;
};

const getActiveSegmentLimit = (sessions: PlanSession[]) => {
	const currentIndex = getCurrentSessionIndex(sessions);
	return currentIndex ?? Math.max(sessions.length - 1, 0);
};

const getPathNodeState = (
	session: PlanSession,
	index: number,
	currentIndex: number | null,
): LearningPathNodeState => {
	if (session.completed) return "completed";
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
			<Path
				d={STEP_HALO_PATH}
				fill="none"
				stroke={
					variant === "solid"
						? DAYOVA_DESIGN_SYSTEM.colors.path4
						: DAYOVA_DESIGN_SYSTEM.colors.path1
				}
				strokeWidth={STEP_SELECTION_STROKE_WIDTH}
			/>
			{variant === "solid" ? (
				<Path
					d={STEP_HALO_PATH}
					fill="none"
					stroke={DAYOVA_DESIGN_SYSTEM.colors.light1}
					strokeWidth={3.5}
				/>
			) : (
				<>
					<Path
						d="M51 3.9C68.8 5.7 83.2 17.3 87.4 32.9"
						fill="none"
						stroke={DAYOVA_DESIGN_SYSTEM.colors.path6}
						strokeLinecap="round"
						strokeWidth={STEP_SELECTION_STROKE_WIDTH}
					/>
					<Path
						d="M88.1 52.4C83.8 68.7 69.1 80.5 51.5 82"
						fill="none"
						stroke={DAYOVA_DESIGN_SYSTEM.colors.path6}
						strokeLinecap="round"
						strokeWidth={STEP_SELECTION_STROKE_WIDTH}
					/>
					<Path
						d="M34.3 80.9C18.6 76.3 7.2 64.3 4.1 49.1"
						fill="none"
						stroke={DAYOVA_DESIGN_SYSTEM.colors.path6}
						strokeLinecap="round"
						strokeWidth={STEP_SELECTION_STROKE_WIDTH}
					/>
				</>
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
					backgroundColor: faceColor,
					alignItems: "center",
					justifyContent: "center",
					overflow: "hidden",
				}}
			>
				<View
					style={{
						position: "absolute",
						top: -9,
						right: isLocked ? -7 : -4,
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
			accessibilityLabel={`${title}, ${PHASE_LABEL[session.phase]}, ${session.dateLabel}, ${stateLabel}`}
			accessibilityHint={
				isLocked
					? "Wählt diesen gesperrten Lernblock aus und zeigt die Vorschau. Gesperrte Lernblöcke können noch nicht geöffnet werden."
					: "Wählt diesen Lernblock aus und zeigt die Vorschau. Öffnen kannst du ihn danach über die Pfeiltaste in der Vorschau."
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

function LearningPath({
	onSelectSession,
	selectedSessionId,
	sessions,
}: {
	onSelectSession: (session: PlanSession) => void;
	selectedSessionId: Id<"learningPlanSessions"> | null;
	sessions: PlanSession[];
}) {
	const currentIndex = getCurrentSessionIndex(sessions);
	const activeSegmentLimit = getActiveSegmentLimit(sessions);
	const pathHeight = getFigmaPathHeight(sessions.length);
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
			</Svg>

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
		</View>
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
			? getPathNodeState(
					selectedSession,
					selectedSessionIndex,
					getCurrentSessionIndex(snapshot.sessions),
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
					title="Lernplan"
					onBack={goBack}
					className="mb-0"
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
						selectedSessionId={selectedSession.id}
						sessions={snapshot.sessions}
						onSelectSession={(session) => setSelectedSessionId(session.id)}
					/>
				) : (
					<View />
				)}
			</ScrollView>
		</Screen>
	);
}
