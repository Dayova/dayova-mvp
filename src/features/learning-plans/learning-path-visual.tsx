import { type ReactNode, useEffect } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import {
	Check,
	Dumbbell,
	GraduationCap,
	Note,
	Repeat,
	Sparkles,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import {
	getLearningPathNodePresentation,
	LEARNING_PATH_BREATHING,
	type LearningPathNodeIcon,
	type LearningPathNodeState,
	type LearningPathNodeTone,
} from "~/features/learning-plans/learning-path-node-presentation";
import {
	getCommittedSessionIndex,
	isDiagnosticLearningPlanSession,
	isLearningPlanSessionHistory,
} from "~/features/learning-plans/rolling-learning-window";
import type { PlanSession } from "~/features/learning-plans/types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";

const PHASE_LABEL: Record<PlanSession["phase"], string> = {
	theory: "Theorie",
	practice: "Üben",
	rehearsal: "Praxis",
};

const LEARNING_PATH_ICON_COMPONENT = {
	check: Check,
	dumbbell: Dumbbell,
	note: Note,
	repeat: Repeat,
} satisfies Record<LearningPathNodeIcon, typeof Dumbbell>;

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

const PATH_WIDTH = 345;
const SCREEN_MINIMUM_PATH_HEIGHT = 444;
const PATH_CYCLE_HEIGHT = 384;
const FIRST_NODE_FRAME = {
	left: 138.5,
	top: 0,
	width: 68,
	height: 64,
} satisfies PathNodeFrame;
const REPEATING_NODE_FRAMES = [
	{ left: 237, top: 88, width: 100, height: 92 },
	{ left: 138.5, top: 204, width: 68, height: 64 },
	{ left: 24, top: 292, width: 68, height: 64 },
	{ left: 138.5, top: 380, width: 68, height: 64 },
] satisfies PathNodeFrame[];

const getNodeFrame = (index: number): PathNodeFrame => {
	if (index === 0) return FIRST_NODE_FRAME;

	const repeatingIndex = (index - 1) % REPEATING_NODE_FRAMES.length;
	const cycle = Math.floor((index - 1) / REPEATING_NODE_FRAMES.length);
	const frame =
		REPEATING_NODE_FRAMES[repeatingIndex] ?? REPEATING_NODE_FRAMES[0];

	return {
		...frame,
		top: frame.top + cycle * PATH_CYCLE_HEIGHT,
	};
};

const getSegmentPath = (index: number) => {
	const segmentIndex = index % REPEATING_NODE_FRAMES.length;
	const y =
		Math.floor(index / REPEATING_NODE_FRAMES.length) * PATH_CYCLE_HEIGHT;

	if (segmentIndex === 0) {
		return `M 206 ${26 + y} H 249 Q 289 ${26 + y} 289 ${66 + y} V ${102 + y}`;
	}
	if (segmentIndex === 1) {
		return `M 289 ${158 + y} V ${194 + y} Q 289 ${234 + y} 249 ${
			234 + y
		} H 206`;
	}
	if (segmentIndex === 2) {
		return `M 139 ${230 + y} H 96 Q 56 ${230 + y} 56 ${270 + y} V ${293 + y}`;
	}

	return `M 56 ${348 + y} V ${370 + y} Q 56 ${410 + y} 96 ${410 + y} H 139`;
};

const getSegmentEndPoint = (index: number) => {
	const segmentIndex = index % REPEATING_NODE_FRAMES.length;
	const cycle = Math.floor(index / REPEATING_NODE_FRAMES.length);
	const cycleOffset = cycle * PATH_CYCLE_HEIGHT;
	const endpoint = [
		{ x: 289, y: 102 },
		{ x: 206, y: 234 },
		{ x: 56, y: 293 },
		{ x: 139, y: 410 },
	][segmentIndex] ?? { x: 139, y: 410 };

	return { x: endpoint.x, y: endpoint.y + cycleOffset };
};

const getPathHeight = (sessionCount: number, mode: "artwork" | "screen") => {
	const lastFrame = getNodeFrame(Math.max(sessionCount - 1, 0));
	const contentHeight = lastFrame.top + lastFrame.height + 8;

	return mode === "screen"
		? Math.max(SCREEN_MINIMUM_PATH_HEIGHT, contentHeight + 12)
		: contentHeight;
};

export const getLearningPathNodeState = (
	session: PlanSession,
	index: number,
	currentIndex: number | null,
): LearningPathNodeState => {
	if (isLearningPlanSessionHistory(session)) return "completed";
	if (session.planningStatus === "provisional") return "locked";
	if (currentIndex !== null && index === currentIndex) return "current";
	return "locked";
};

export type LearningPathArtworkNode = Readonly<{
	id: string;
	phase: PlanSession["phase"];
	state: LearningPathNodeState;
}>;

const getActiveSegmentLimit = (nodes: readonly LearningPathArtworkNode[]) => {
	const currentIndex = nodes.findIndex((node) => node.state === "current");
	if (currentIndex >= 0) return currentIndex;

	const firstLockedIndex = nodes.findIndex((node) => node.state === "locked");
	return firstLockedIndex >= 0
		? firstLockedIndex
		: Math.max(nodes.length - 1, 0);
};

const STEP_PUCK_DIMENSIONS = {
	compact: { faceHeight: 46, height: 52, width: 52 },
	prominent: { faceHeight: 52, height: 59, width: 60 },
} satisfies Record<
	"compact" | "prominent",
	{ faceHeight: number; height: number; width: number }
>;
const STEP_PUCK_LIP_OFFSET = 6;
const STEP_SELECTION_WIDTH = 92;
const STEP_SELECTION_HEIGHT = 86;
const STEP_SELECTION_STROKE_WIDTH = 4;
const STEP_HALO_PATH =
	"M46 3.5C69.4721 3.5 88.5 21.1848 88.5 43C88.5 64.8152 69.4721 82.5 46 82.5C22.5279 82.5 3.5 64.8152 3.5 43C3.5 21.1848 22.5279 3.5 46 3.5Z";

const getStepFrameStyle = (left: number, top: number) =>
	({
		position: "absolute",
		left,
		top,
		width: STEP_SELECTION_WIDTH,
		height: STEP_SELECTION_HEIGHT,
		alignItems: "center",
		justifyContent: "center",
	}) satisfies ViewStyle;

function StepHalo({
	testID,
	tone,
}: {
	testID: string;
	tone: LearningPathNodeTone;
}) {
	return (
		<Svg
			pointerEvents="none"
			width={STEP_SELECTION_WIDTH}
			height={STEP_SELECTION_HEIGHT}
			viewBox={`0 0 ${STEP_SELECTION_WIDTH} ${STEP_SELECTION_HEIGHT}`}
			// The selection halo uses fixed SVG artboard geometry.
			style={{ position: "absolute", left: 0, top: 0 }}
		>
			<Path
				d={STEP_HALO_PATH}
				fill="none"
				stroke={
					tone === "blue"
						? DAYOVA_DESIGN_SYSTEM.colors.path6
						: DAYOVA_DESIGN_SYSTEM.colors.path4
				}
				strokeWidth={STEP_SELECTION_STROKE_WIDTH}
				testID={testID}
			/>
		</Svg>
	);
}

function BreathingStep({
	children,
	left,
	top,
}: {
	children: ReactNode;
	left: number;
	top: number;
}) {
	const reduceMotion = useReducedMotion();
	const scale = useSharedValue<number>(
		!reduceMotion ? LEARNING_PATH_BREATHING.minScale : 1,
	);

	useEffect(() => {
		cancelAnimation(scale);

		if (reduceMotion) {
			scale.set(1);
			return;
		}

		scale.set(LEARNING_PATH_BREATHING.minScale);
		scale.set(
			withRepeat(
				withTiming(LEARNING_PATH_BREATHING.maxScale, {
					duration: LEARNING_PATH_BREATHING.halfCycleMs,
					easing: Easing.inOut(Easing.sin),
				}),
				-1,
				true,
			),
		);

		return () => cancelAnimation(scale);
	}, [reduceMotion, scale]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.get() }],
	}));

	return (
		<Animated.View
			pointerEvents="none"
			// Generated node coordinates and the Reanimated scale require style.
			style={[getStepFrameStyle(left, top), animatedStyle]}
		>
			{children}
		</Animated.View>
	);
}

function StepFrame({
	children,
	breathes,
	left,
	top,
}: {
	children: ReactNode;
	breathes: boolean;
	left: number;
	top: number;
}) {
	if (breathes) {
		return (
			<BreathingStep left={left} top={top}>
				{children}
			</BreathingStep>
		);
	}

	return (
		<View
			pointerEvents="none"
			// Learning Path nodes use generated artboard coordinates.
			style={getStepFrameStyle(left, top)}
		>
			{children}
		</View>
	);
}

function StepPuck({
	icon,
	locked,
	testID,
	tone,
}: {
	icon: LearningPathNodeIcon;
	locked: boolean;
	testID: string;
	tone: LearningPathNodeTone;
}) {
	const isCompleted = tone === "blue";
	const Icon = LEARNING_PATH_ICON_COMPONENT[icon];
	const {
		faceHeight,
		height: puckHeight,
		width: puckWidth,
	} = STEP_PUCK_DIMENSIONS[locked ? "compact" : "prominent"];
	const baseColor = isCompleted
		? DAYOVA_DESIGN_SYSTEM.colors.path5
		: DAYOVA_DESIGN_SYSTEM.colors.pathLockedBase;
	const faceColor = isCompleted
		? DAYOVA_DESIGN_SYSTEM.colors.path6
		: DAYOVA_DESIGN_SYSTEM.colors.path1;
	const iconColor = isCompleted
		? DAYOVA_DESIGN_SYSTEM.colors.light1
		: DAYOVA_DESIGN_SYSTEM.colors.path3;

	return (
		<View
			pointerEvents="none"
			testID={testID}
			// The puck is native artwork with runtime state colors and dimensions.
			style={{
				width: puckWidth,
				height: puckHeight,
				alignItems: "center",
				borderRadius: puckHeight / 2,
				boxShadow: isCompleted
					? "0 5px 9px rgba(0, 160, 230, 0.2)"
					: locked
						? "0 5px 8px rgba(105, 117, 134, 0.16)"
						: "0 5px 9px rgba(105, 117, 134, 0.22)",
			}}
		>
			<View
				// Native artwork geometry creates the puck's lower lip.
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
				// Native artwork geometry creates the puck's face.
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
					testID={`${testID}-face`}
					// Runtime puck dimensions keep compact and prominent states aligned.
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
						// The highlight is coordinate-based native artwork.
						style={{
							position: "absolute",
							top: -9,
							right: locked ? -5 : -2,
							width: locked ? 17 : 21,
							height: locked ? 42 : 48,
							borderRadius: 12,
							backgroundColor: isCompleted
								? DAYOVA_DESIGN_SYSTEM.colors.path7
								: DAYOVA_DESIGN_SYSTEM.colors.light1,
							opacity: isCompleted ? 0.68 : 0.2,
							transform: [{ rotate: "31deg" }],
						}}
					/>
				</View>
				<Icon
					size={locked ? 23 : 28}
					color={iconColor}
					strokeWidth={icon === "check" ? 3.6 : 2.75}
					// The icon library exposes stacking through its native style prop.
					style={{ zIndex: 1 }}
				/>
			</View>
		</View>
	);
}

function PathNodeVisual({
	frame,
	motionEnabled,
	node,
	selected,
}: {
	frame: PathNodeFrame;
	motionEnabled: boolean;
	node: LearningPathArtworkNode;
	selected: boolean;
}) {
	const isLocked = node.state === "locked";
	const presentation = getLearningPathNodePresentation({
		phase: node.phase,
		selected,
		state: node.state,
	});
	const puckDimensions =
		STEP_PUCK_DIMENSIONS[isLocked ? "compact" : "prominent"];

	return (
		<StepFrame
			breathes={motionEnabled && presentation.motion === "breathe"}
			left={(frame.width - STEP_SELECTION_WIDTH) / 2}
			top={(frame.height - STEP_SELECTION_HEIGHT) / 2}
		>
			{presentation.halo !== "none" ? (
				<StepHalo
					testID={`learning-path-node-halo-${node.id}`}
					tone={presentation.tone}
				/>
			) : null}
			<View
				// Runtime puck dimensions center each state within the selection frame.
				style={{
					position: "absolute",
					left: (STEP_SELECTION_WIDTH - puckDimensions.width) / 2,
					top: (STEP_SELECTION_HEIGHT - puckDimensions.height) / 2,
					zIndex: 1,
				}}
			>
				<StepPuck
					icon={presentation.icon}
					locked={isLocked}
					testID={`learning-path-node-puck-${node.id}`}
					tone={presentation.tone}
				/>
			</View>
		</StepFrame>
	);
}

function ArtworkPathNode({
	frame,
	node,
}: {
	frame: PathNodeFrame;
	node: LearningPathArtworkNode;
}) {
	const position = {
		left: frame.left,
		top: frame.top,
		width: frame.width,
		height: frame.height,
	} satisfies ViewStyle;
	return (
		<View
			accessible={false}
			pointerEvents="none"
			className="absolute items-center justify-center"
			// Learning Path nodes use generated artboard coordinates.
			style={position}
			testID={`learning-path-node-${node.id}`}
		>
			<PathNodeVisual
				frame={frame}
				motionEnabled={false}
				node={node}
				selected={node.state === "current"}
			/>
		</View>
	);
}

function ScreenPathNode({
	frame,
	onPress,
	selected,
	session,
	state,
}: {
	frame: PathNodeFrame;
	onPress: () => void;
	selected: boolean;
	session: PlanSession;
	state: LearningPathNodeState;
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
	const node = {
		id: session.id,
		phase: session.phase,
		state,
	} satisfies LearningPathArtworkNode;

	return (
		<Pressable
			accessibilityLabel={`${title}, ${
				isDiagnosticLearningPlanSession(session)
					? "Wissenscheck"
					: PHASE_LABEL[session.phase]
			}, ${session.dateLabel} um ${session.startTime}, ${stateLabel}`}
			accessibilityHint={
				isLocked
					? "Zeigt den voraussichtlich folgenden Lernblock. Er kann sich nach der nächsten Session noch ändern."
					: selected
						? "Öffnet diesen Lernblock."
						: "Wählt diesen Lernblock aus. Ein weiterer Tipp öffnet ihn."
			}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			className="absolute items-center justify-center"
			// Learning Path nodes use generated artboard coordinates.
			style={position}
			testID={`learning-path-node-${session.id}`}
		>
			<PathNodeVisual
				frame={frame}
				motionEnabled
				node={node}
				selected={selected}
			/>
		</Pressable>
	);
}

type ScreenLearningPathVisualProps = {
	mode: "screen";
	examCountdownLabel: string | null;
	examDateLabel: string;
	onOpenSession: (session: PlanSession) => void;
	onSelectSession: (session: PlanSession) => void;
	selectedSessionId: PlanSession["id"] | null;
	sessions: PlanSession[];
	showsAdaptiveContinuation: boolean;
};

type ArtworkLearningPathVisualProps = {
	mode: "artwork";
	height: number;
	nodes: readonly LearningPathArtworkNode[];
	width: number;
};

type LearningPathVisualProps =
	| ScreenLearningPathVisualProps
	| ArtworkLearningPathVisualProps;

function LearningPathSurface({ props }: { props: LearningPathVisualProps }) {
	const { mode } = props;
	const screenProps = props.mode === "screen" ? props : null;
	const currentIndex = screenProps
		? getCommittedSessionIndex(screenProps.sessions)
		: null;
	const nodes: readonly LearningPathArtworkNode[] =
		props.mode === "screen"
			? props.sessions.map((session, index) => ({
					id: session.id,
					phase: session.phase,
					state: getLearningPathNodeState(session, index, currentIndex),
				}))
			: props.nodes;
	const activeSegmentLimit = getActiveSegmentLimit(nodes);
	const showsAdaptiveContinuation =
		screenProps?.showsAdaptiveContinuation === true;
	const continuationSegmentIndex = Math.max(nodes.length - 1, 0);
	const continuationPath = getSegmentPath(continuationSegmentIndex);
	const continuationEndpoint = getSegmentEndPoint(continuationSegmentIndex);
	const continuationTop = continuationEndpoint.y + 16;
	const basePathHeight = getPathHeight(nodes.length, mode);
	const pathHeight = showsAdaptiveContinuation
		? Math.max(basePathHeight, continuationTop + 220)
		: basePathHeight;
	const segments = nodes.slice(1).map((_, index) => ({
		d: getSegmentPath(index),
		active: index < activeSegmentLimit,
	}));

	return (
		<View
			className="relative self-center"
			// Path height is generated from the runtime node count.
			style={{ width: PATH_WIDTH, height: pathHeight }}
		>
			<Svg
				width={PATH_WIDTH}
				height={pathHeight}
				viewBox={`0 0 ${PATH_WIDTH} ${pathHeight}`}
				// The connector track uses fixed SVG artboard geometry.
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
					// The endpoint follows the generated connector path.
					style={{
						left: continuationEndpoint.x - 6,
						top: continuationEndpoint.y - 6,
					}}
					testID="adaptive-continuation-endpoint"
				/>
			) : null}

			{props.mode === "screen"
				? props.sessions.map((session, index) => {
						const state = nodes[index]?.state ?? "locked";
						const selected = session.id === props.selectedSessionId;

						return (
							<ScreenPathNode
								key={session.id}
								frame={getNodeFrame(index)}
								selected={selected}
								session={session}
								state={state}
								onPress={() => {
									if (selected && state !== "locked") {
										props.onOpenSession(session);
										return;
									}
									props.onSelectSession(session);
								}}
							/>
						);
					})
				: props.nodes.map((node, index) => (
						<ArtworkPathNode
							key={node.id}
							frame={getNodeFrame(index)}
							node={node}
						/>
					))}

			{showsAdaptiveContinuation && screenProps ? (
				<View
					accessible
					accessibilityLabel={`Dayova plant mit dir weiter. Nach deinem Abschluss passt Dayova die Vorschau an und plant den nächsten Termin. Prüfung am ${
						screenProps.examDateLabel
					}${
						screenProps.examCountdownLabel
							? `, ${screenProps.examCountdownLabel}`
							: ""
					}.`}
					className="absolute right-2 left-2 gap-4 overflow-hidden rounded-card border border-primary/20 bg-system-subtle px-4 py-4"
					// The top follows generated path geometry; borderCurve is a native API.
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
								{screenProps.examDateLabel}
							</Text>
						</View>
						{screenProps.examCountdownLabel ? (
							<View className="shrink-0 rounded-full bg-card px-3 py-2">
								<Text className="font-poppins font-semibold text-body-5 text-primary">
									{screenProps.examCountdownLabel}
								</Text>
							</View>
						) : null}
					</View>
				</View>
			) : null}
		</View>
	);
}

export function LearningPathVisual(props: LearningPathVisualProps) {
	if (props.mode === "screen") {
		return <LearningPathSurface props={props} />;
	}

	const artworkHeight = getPathHeight(props.nodes.length, "artwork");
	const scale = Math.min(
		props.width / PATH_WIDTH,
		props.height / artworkHeight,
	);

	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			className="items-center justify-center"
			// Artwork frame dimensions are responsive runtime inputs.
			style={{ width: props.width, height: props.height }}
			testID="learning-path-artwork-visual"
		>
			<View
				// Runtime scaling fits the shared artboard into the onboarding frame.
				style={{
					width: PATH_WIDTH,
					height: artworkHeight,
					transform: [{ scale }],
				}}
			>
				<LearningPathSurface props={props} />
			</View>
		</View>
	);
}
