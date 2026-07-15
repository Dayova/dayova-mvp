import type { ComponentType } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
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
	BookOpen,
	Check,
	Dumbbell,
	Rocket,
	SquareLock,
} from "~/components/ui/icon";
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
	rehearsal: "Praxis",
};

const PHASE_ICON = {
	theory: BookOpen,
	practice: Dumbbell,
	rehearsal: Rocket,
} satisfies Record<
	PlanSession["phase"],
	ComponentType<React.ComponentProps<typeof Dumbbell>>
>;

const NODE_BUTTON_SIZE = 72;
const NODE_FACE_HEIGHT = 64;
const NODE_DEPTH = 8;
const NODE_ORBIT_WIDTH = 96;
const NODE_ORBIT_HEIGHT = 88;

function SelectionOrbit({ color }: { color: string }) {
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
			<Svg
				accessible={false}
				width={NODE_ORBIT_WIDTH}
				height={NODE_ORBIT_HEIGHT}
				viewBox={`0 0 ${NODE_ORBIT_WIDTH} ${NODE_ORBIT_HEIGHT}`}
			>
				<Circle
					cx={NODE_ORBIT_WIDTH / 2}
					cy={NODE_ORBIT_HEIGHT / 2}
					r={41}
					fill="none"
					stroke={color}
					strokeDasharray={[62, 69]}
					strokeLinecap="round"
					strokeWidth={5}
					transform={`rotate(-20 ${NODE_ORBIT_WIDTH / 2} ${NODE_ORBIT_HEIGHT / 2})`}
				/>
			</Svg>
		</Animated.View>
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
	const { colors, isDark } = useDayovaTheme();
	const locked = state === "locked";
	const completed = state === "completed";
	const PhaseIcon = PHASE_ICON[session.phase];
	const faceColor = locked
		? isDark
			? colors.path3
			: colors.path1
		: colors.primary;
	const baseColor = locked
		? isDark
			? colors.path1
			: colors.path3
		: colors.primaryStrong;
	const orbitColor = locked ? colors.secondaryText : colors.primary;
	const title = formatGermanUiText(session.title);

	return (
		<Pressable
			accessible
			accessibilityHint={
				locked
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
			{selected ? <SelectionOrbit color={orbitColor} /> : null}

			<View
				pointerEvents="none"
				style={{
					position: "absolute",
					left: (frame.width - NODE_BUTTON_SIZE) / 2,
					top: (frame.height - NODE_BUTTON_SIZE) / 2,
					width: NODE_BUTTON_SIZE,
					height: NODE_BUTTON_SIZE,
				}}
			>
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
						backgroundColor: faceColor,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<View
						style={{
							position: "absolute",
							left: 16,
							top: 7,
							width: 40,
							height: 7,
							borderRadius: 99,
							backgroundColor: "rgba(255, 255, 255, 0.18)",
						}}
					/>
					{locked ? (
						<SquareLock
							size={27}
							color={DAYOVA_DESIGN_SYSTEM.colors.light1}
							strokeWidth={2}
						/>
					) : completed ? (
						<Check
							size={29}
							color={DAYOVA_DESIGN_SYSTEM.colors.light1}
							strokeWidth={2.5}
						/>
					) : (
						<PhaseIcon
							size={28}
							color={DAYOVA_DESIGN_SYSTEM.colors.light1}
							strokeWidth={2.2}
						/>
					)}
				</View>
			</View>
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
