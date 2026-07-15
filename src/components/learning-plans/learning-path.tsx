import { useEffect } from "react";
import type { Icon } from "phosphor-react-native";
import { ArrowsClockwiseIcon } from "phosphor-react-native/src/icons/ArrowsClockwise";
import { CheckIcon } from "phosphor-react-native/src/icons/Check";
import { FileTextIcon } from "phosphor-react-native/src/icons/FileText";
import { WrenchIcon } from "phosphor-react-native/src/icons/Wrench";
import { Pressable, View } from "react-native";
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
	ZoomIn,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import type { Id } from "#convex/_generated/dataModel";
import {
	getCurrentLearningPathIndex,
	getLearningPathHeight,
	getLearningPathNodeFrame,
	getLearningPathNodeState,
	LEARNING_PATH_WIDTH,
	type LearningPathNodeFrame,
	type LearningPathNodeState,
} from "~/components/learning-plans/learning-path-layout";
import {
	getLearningPathNodeIconKind,
	type LearningPathNodeIconKind,
} from "~/components/learning-plans/learning-path-presentation";
import type { PlanSession } from "~/features/learning-plans/types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";

const NODE_STATE_LABEL: Record<LearningPathNodeState, string> = {
	completed: "abgeschlossen",
	current: "verfügbar",
	locked: "gesperrt",
};

const PHASE_LABEL: Record<PlanSession["phase"], string> = {
	theory: "Theorie",
	practice: "Üben",
	rehearsal: "Wiederholen",
};

const NODE_ICON = {
	completed: CheckIcon,
	theory: FileTextIcon,
	practice: WrenchIcon,
	repeat: ArrowsClockwiseIcon,
} satisfies Record<LearningPathNodeIconKind, Icon>;

const NODE_BUTTON_SIZE = 68;
const NODE_FACE_HEIGHT = 61;
const NODE_DEPTH = 7;
const NODE_ORBIT_WIDTH = 96;
const NODE_ORBIT_HEIGHT = 88;
const NODE_ORBIT_RADIUS = 40;
const COMPLETED_RIM_SIZE = 78;

const LOCKED_FACE_COLOR = "#E4E6E9";
const LOCKED_BASE_COLOR = "#BFC3C8";
const LOCKED_ICON_COLOR = "#A7ABB0";
const ORBIT_IDLE_COLOR = "#DFE2E6";

function ActiveOrbit({ color }: { color: string }) {
	const reduceMotion = useReducedMotion();
	const rotation = useSharedValue(0);

	useEffect(() => {
		if (reduceMotion) return;

		rotation.value = withRepeat(
			withTiming(360, {
				duration: 5200,
				easing: Easing.linear,
			}),
			-1,
			false,
		);

		return () => cancelAnimation(rotation);
	}, [reduceMotion, rotation]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	return (
		<Animated.View
			entering={ZoomIn.duration(180)}
			exiting={FadeOut.duration(120)}
			pointerEvents="none"
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: NODE_ORBIT_WIDTH,
				height: NODE_ORBIT_HEIGHT,
			}}
		>
			<Animated.View style={animatedStyle}>
				<Svg
					accessible={false}
					width={NODE_ORBIT_WIDTH}
					height={NODE_ORBIT_HEIGHT}
					viewBox={`0 0 ${NODE_ORBIT_WIDTH} ${NODE_ORBIT_HEIGHT}`}
				>
					<Circle
						cx={NODE_ORBIT_WIDTH / 2}
						cy={NODE_ORBIT_HEIGHT / 2}
						r={NODE_ORBIT_RADIUS}
						fill="none"
						stroke={ORBIT_IDLE_COLOR}
						strokeDasharray={[54, 30]}
						strokeLinecap="round"
						strokeWidth={5}
						transform={`rotate(-72 ${NODE_ORBIT_WIDTH / 2} ${NODE_ORBIT_HEIGHT / 2})`}
					/>
					<Circle
						cx={NODE_ORBIT_WIDTH / 2}
						cy={NODE_ORBIT_HEIGHT / 2}
						r={NODE_ORBIT_RADIUS}
						fill="none"
						stroke={color}
						strokeDasharray={[58, 13, 58, 122]}
						strokeLinecap="round"
						strokeWidth={5}
						transform={`rotate(-72 ${NODE_ORBIT_WIDTH / 2} ${NODE_ORBIT_HEIGHT / 2})`}
					/>
				</Svg>
			</Animated.View>
		</Animated.View>
	);
}

function LearningPathPuck({
	iconKind,
	state,
}: {
	iconKind: LearningPathNodeIconKind;
	state: LearningPathNodeState;
}) {
	const { colors } = useDayovaTheme();
	const locked = state === "locked";
	const completed = state === "completed";
	const NodeIcon = NODE_ICON[iconKind];
	const faceColor = locked ? LOCKED_FACE_COLOR : colors.primary;
	const baseColor = locked ? LOCKED_BASE_COLOR : colors.primaryStrong;
	const iconColor = locked
		? LOCKED_ICON_COLOR
		: DAYOVA_DESIGN_SYSTEM.colors.light1;

	return (
		<View
			pointerEvents="none"
			style={{
				position: "absolute",
				left: (NODE_ORBIT_WIDTH - NODE_BUTTON_SIZE) / 2,
				top: (NODE_ORBIT_HEIGHT - NODE_BUTTON_SIZE) / 2,
				width: NODE_BUTTON_SIZE,
				height: NODE_BUTTON_SIZE,
			}}
		>
			{completed ? (
				<View
					style={{
						position: "absolute",
						left: (NODE_BUTTON_SIZE - COMPLETED_RIM_SIZE) / 2,
						top: (NODE_BUTTON_SIZE - COMPLETED_RIM_SIZE) / 2 - 1,
						width: COMPLETED_RIM_SIZE,
						height: COMPLETED_RIM_SIZE,
						borderRadius: COMPLETED_RIM_SIZE / 2,
						backgroundColor: "#758091",
					}}
				/>
			) : null}

			<View
				style={{
					position: "absolute",
					left: 0,
					top: NODE_DEPTH,
					width: NODE_BUTTON_SIZE,
					height: NODE_FACE_HEIGHT,
					borderRadius: NODE_BUTTON_SIZE / 2,
					backgroundColor: baseColor,
				}}
			/>
			<View
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: NODE_BUTTON_SIZE,
					height: NODE_FACE_HEIGHT,
					borderRadius: NODE_BUTTON_SIZE / 2,
					borderWidth: completed ? 4 : 0,
					borderColor: DAYOVA_DESIGN_SYSTEM.colors.light2,
					backgroundColor: faceColor,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<View
					style={{
						position: "absolute",
						left: 15,
						top: completed ? 7 : 6,
						width: 38,
						height: 7,
						borderRadius: 99,
						backgroundColor: locked
							? "rgba(255, 255, 255, 0.28)"
							: "rgba(255, 255, 255, 0.18)",
					}}
				/>
				<NodeIcon
					size={completed ? 30 : 29}
					color={iconColor}
					weight={iconKind === "repeat" ? "bold" : completed ? "bold" : "fill"}
				/>
			</View>
		</View>
	);
}

function LearningPathNode({
	frame,
	onPress,
	selected,
	session,
	state,
}: {
	frame: LearningPathNodeFrame;
	onPress: () => void;
	selected: boolean;
	session: PlanSession;
	state: LearningPathNodeState;
}) {
	const { colors } = useDayovaTheme();
	const reduceMotion = useReducedMotion();
	const breathingScale = useSharedValue(1);
	const current = state === "current";
	const iconKind = getLearningPathNodeIconKind(session.phase, state);
	const title = formatGermanUiText(session.title);

	useEffect(() => {
		if (!current || reduceMotion) {
			cancelAnimation(breathingScale);
			breathingScale.value = 1;
			return;
		}

		breathingScale.value = withRepeat(
			withSequence(
				withTiming(1.055, {
					duration: 900,
					easing: Easing.inOut(Easing.quad),
				}),
				withTiming(0.965, {
					duration: 900,
					easing: Easing.inOut(Easing.quad),
				}),
			),
			-1,
			false,
		);

		return () => cancelAnimation(breathingScale);
	}, [breathingScale, current, reduceMotion]);

	const breathingStyle = useAnimatedStyle(() => ({
		transform: [{ scale: breathingScale.value }],
	}));

	return (
		<Pressable
			accessible
			accessibilityHint={
				state === "locked"
					? "Wählt diesen gesperrten Lernblock aus und zeigt die Vorschau. Gesperrte Lernblöcke können noch nicht geöffnet werden."
					: "Wählt diesen Lernblock aus und zeigt die Vorschau. Öffnen kannst du ihn danach über die Pfeiltaste in der Vorschau."
			}
			accessibilityLabel={`${title}, ${PHASE_LABEL[session.phase]}, ${session.dateLabel}, ${NODE_STATE_LABEL[state]}`}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			focusable
			onPress={onPress}
			style={({ pressed }) => ({
				position: "absolute",
				left: frame.left,
				top: frame.top,
				width: frame.width,
				height: frame.height,
				alignItems: "center",
				justifyContent: "center",
				opacity: pressed ? 0.92 : 1,
				transform: [{ scale: pressed ? 0.96 : 1 }],
			})}
		>
			<Animated.View
				style={[
					{
						position: "relative",
						width: NODE_ORBIT_WIDTH,
						height: NODE_ORBIT_HEIGHT,
					},
					breathingStyle,
				]}
			>
				{current ? <ActiveOrbit color={colors.primary} /> : null}
				<LearningPathPuck iconKind={iconKind} state={state} />
			</Animated.View>
		</Pressable>
	);
}

export function LearningPath({
	onSelectSession,
	selectedSessionId,
	sessions,
}: {
	onSelectSession: (session: PlanSession) => void;
	selectedSessionId: Id<"learningPlanSessions"> | null;
	sessions: PlanSession[];
}) {
	const currentIndex = getCurrentLearningPathIndex(sessions);
	const pathHeight = getLearningPathHeight(sessions.length);

	return (
		<Animated.View
			entering={FadeIn.duration(180)}
			exiting={FadeOut.duration(120)}
			style={{
				position: "relative",
				alignSelf: "center",
				width: LEARNING_PATH_WIDTH,
				height: pathHeight,
			}}
		>
			{sessions.map((session, index) => (
				<LearningPathNode
					key={session.id}
					frame={getLearningPathNodeFrame(index)}
					onPress={() => onSelectSession(session)}
					selected={session.id === selectedSessionId}
					session={session}
					state={getLearningPathNodeState(session, index, currentIndex)}
				/>
			))}
		</Animated.View>
	);
}
