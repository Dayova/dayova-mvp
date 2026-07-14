import { useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import {
	ArrowUpRight,
	BookOpen,
	Dumbbell,
	Note,
	Rocket,
	SquareLock,
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
	session,
	onOpen,
}: {
	canOpen: boolean;
	session: PlanSession;
	onOpen: () => void;
}) {
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
					<Time04
						size={13}
						color={DAYOVA_DESIGN_SYSTEM.colors.secondaryText}
						strokeWidth={2}
					/>
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

type PathNodeState = "completed" | "current" | "locked";

const PATH_NODE_STATE_LABEL: Record<PathNodeState, string> = {
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
): PathNodeState => {
	if (session.completed) return "completed";
	if (currentIndex !== null && index === currentIndex) return "current";
	return "locked";
};

const STEP_PUCK_WIDTH = 68;
const STEP_PUCK_HEIGHT = 64;
const STEP_LOCKED_FACE_WIDTH = 58;
const STEP_LOCKED_FACE_HEIGHT = 50;
const STEP_SELECTION_WIDTH = 92;
const STEP_SELECTION_HEIGHT = 86;
const STEP_SELECTION_STROKE_WIDTH = 7;

function SelectedStepRing() {
	return (
		<Svg
			pointerEvents="none"
			width={STEP_SELECTION_WIDTH}
			height={STEP_SELECTION_HEIGHT}
			viewBox={`0 0 ${STEP_SELECTION_WIDTH} ${STEP_SELECTION_HEIGHT}`}
			style={{ position: "absolute", left: 0, top: 0 }}
		>
			<Path
				d="M46 3.5C69.4721 3.5 88.5 21.1848 88.5 43C88.5 64.8152 69.4721 82.5 46 82.5C22.5279 82.5 3.5 64.8152 3.5 43C3.5 21.1848 22.5279 3.5 46 3.5Z"
				fill={DAYOVA_DESIGN_SYSTEM.colors.light1}
				stroke={DAYOVA_DESIGN_SYSTEM.colors.path4}
				strokeWidth={STEP_SELECTION_STROKE_WIDTH}
			/>
		</Svg>
	);
}

function CompletedStepPuck() {
	return (
		<Svg
			pointerEvents="none"
			width={92}
			height={88}
			viewBox="0 0 92 88"
			style={{ position: "absolute", left: -12, top: -9 }}
		>
			<Path
				d="M46 12.5C64.5705 12.5 79.5 25.548 79.5 41.5C79.5 57.452 64.5705 70.5 46 70.5C27.4295 70.5 12.5 57.452 12.5 41.5C12.5 25.548 27.4295 12.5 46 12.5Z"
				fill={DAYOVA_DESIGN_SYSTEM.colors.path5}
				stroke={DAYOVA_DESIGN_SYSTEM.colors.path5}
			/>
			<Path
				d="M46 9.5C64.2349 9.5 78.5 21.6237 78.5 36C78.5 50.3763 64.2349 62.5 46 62.5C27.7651 62.5 13.5 50.3763 13.5 36C13.5 21.6237 27.7651 9.5 46 9.5Z"
				fill={DAYOVA_DESIGN_SYSTEM.colors.path6}
				stroke={DAYOVA_DESIGN_SYSTEM.colors.path6}
				strokeWidth={3}
			/>
			<Path
				d="M30.903 51.7622L64.11 20.7115C64.6597 20.1975 65.4516 20.0363 66.1352 20.3511C67.4469 20.9552 69.6663 22.1316 71.5059 23.8738C72.701 25.0056 73.9512 26.8471 74.7291 28.0839C75.204 28.839 75.0746 29.8117 74.4487 30.4472L45.3875 59.9555C43.8835 61.4827 41.7537 62.2676 39.6626 61.7967C38.2507 61.4787 36.668 61.0154 35.5059 60.3738C34.2835 59.6989 33.0612 59.0586 31.929 58.4839C29.3791 57.1896 28.8143 53.7152 30.903 51.7622Z"
				fill={DAYOVA_DESIGN_SYSTEM.colors.path7}
				stroke={DAYOVA_DESIGN_SYSTEM.colors.path6}
			/>
			<Path
				d="M24.908 48.3639L53.6381 18.3474C54.6965 17.2416 54.1599 15.4799 52.6404 15.2961C46.6945 14.5769 34.1009 14.4277 25.0055 23.8734C15.7121 33.5246 18.4286 43.1756 20.7331 47.8944C21.5365 49.5396 23.642 49.6866 24.908 48.3639Z"
				fill={DAYOVA_DESIGN_SYSTEM.colors.path7}
				stroke={DAYOVA_DESIGN_SYSTEM.colors.path6}
				strokeLinecap="round"
			/>
			<Path
				d="M39.5 37.2591L42.0858 39.9567C42.7525 40.6522 43.0858 41 43.5 41C43.9143 41 44.2476 40.6522 44.9143 39.9567L53.5 31"
				fill="none"
				stroke={DAYOVA_DESIGN_SYSTEM.colors.light1}
				strokeWidth={4}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
}

function CurrentStepPuck() {
	return (
		<View
			pointerEvents="none"
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: STEP_PUCK_WIDTH,
				height: STEP_PUCK_HEIGHT,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Svg
				width={STEP_PUCK_WIDTH}
				height={STEP_PUCK_HEIGHT}
				viewBox={`0 0 ${STEP_PUCK_WIDTH} ${STEP_PUCK_HEIGHT}`}
			>
				<Path
					d="M34 4.5C52.5705 4.5 67.5 17.548 67.5 33.5C67.5 49.452 52.5705 62.5 34 62.5C15.4295 62.5 0.5 49.452 0.5 33.5C0.5 17.548 15.4295 4.5 34 4.5Z"
					fill={DAYOVA_DESIGN_SYSTEM.colors.path5}
					stroke={DAYOVA_DESIGN_SYSTEM.colors.path5}
				/>

				<Path
					d="M34 1.5C52.2349 1.5 66.5 13.6237 66.5 28C66.5 42.3763 52.2349 54.5 34 54.5C15.7651 54.5 1.5 42.3763 1.5 28C1.5 13.6237 15.7651 1.5 34 1.5Z"
					fill={DAYOVA_DESIGN_SYSTEM.colors.path6}
					stroke={DAYOVA_DESIGN_SYSTEM.colors.path6}
					strokeWidth={3}
				/>
			</Svg>

			<View
				style={{
					position: "absolute",
					top: 15,
					left: 22,
				}}
			>
				<Note
					width={24}
					height={24}
					color={DAYOVA_DESIGN_SYSTEM.colors.light1}
					stroke={DAYOVA_DESIGN_SYSTEM.colors.light1}
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
	state: PathNodeState;
	onPress: () => void;
}) {
	const isLocked = state === "locked";
	const title = formatGermanUiText(session.title);
	const stateLabel = PATH_NODE_STATE_LABEL[state];
	const position = {
		left: frame.left,
		top: frame.top,
		width: frame.width,
		height: frame.height,
	} satisfies ViewStyle;

	const selectedRing = selected ? (
		<View
			pointerEvents="none"
			className="absolute"
			style={{
				left: (frame.width - STEP_SELECTION_WIDTH) / 2,
				top: (frame.height - STEP_SELECTION_HEIGHT) / 2,
				width: STEP_SELECTION_WIDTH,
				height: STEP_SELECTION_HEIGHT,
				zIndex: 0,
			}}
		>
			<SelectedStepRing />
		</View>
	) : null;

	const lockedIcon = (
		<SquareLock
			size={25}
			color={DAYOVA_DESIGN_SYSTEM.colors.light1}
			strokeWidth={1.9}
		/>
	);

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
			{selectedRing}
			<View
				className="absolute items-center"
				style={{
					left: (frame.width - STEP_PUCK_WIDTH) / 2,
					top: (frame.height - STEP_PUCK_HEIGHT) / 2,
					width: STEP_PUCK_WIDTH,
					height: STEP_PUCK_HEIGHT,
					borderRadius: STEP_PUCK_HEIGHT / 2,
					zIndex: 1,
					backgroundColor:
						state === "completed"
							? DAYOVA_DESIGN_SYSTEM.colors.path5
							: "transparent",
					boxShadow:
						state === "completed"
							? "0 4px 12px rgba(0, 0, 0, 0.1)"
							: isLocked
								? "0 8px 14px rgba(105, 117, 134, 0.22)"
								: "0 4px 12px rgba(0, 0, 0, 0.1)",
				}}
			>
				{state === "completed" ? (
					<CompletedStepPuck />
				) : isLocked ? (
					<>
						<View
							className="absolute rounded-full"
							style={{
								top: 0,
								width: STEP_PUCK_WIDTH,
								height: STEP_PUCK_HEIGHT,
								backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.path1,
								borderRadius: STEP_PUCK_HEIGHT / 2,
							}}
						/>
						<View
							className="absolute items-center justify-center rounded-full"
							style={{
								top: 5,
								width: STEP_LOCKED_FACE_WIDTH,
								height: STEP_LOCKED_FACE_HEIGHT,
								backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.path3,
								borderRadius: STEP_LOCKED_FACE_HEIGHT / 2,
							}}
						>
							{lockedIcon}
						</View>
					</>
				) : (
					<CurrentStepPuck />
				)}
			</View>
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
