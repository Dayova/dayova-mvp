import { useConvexAuth, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
	ActivityIndicator,
	Pressable,
	View,
	type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import {
	ArrowUpRight,
	Check,
	Clock3,
	Dumbbell,
	Lock,
	NotebookPen,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
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
	rehearsal: "Testmodus",
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

const screenContentStyle = { rowGap: 28 } satisfies ViewStyle;
const primaryGradient = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;

const getSessionRoute = (
	planId: Id<"learningPlans">,
	sessionId: Id<"learningPlanSessions">,
) => `/learning-plans/${planId}/sessions/${sessionId}/edit` as const;

function SessionPreviewCard({
	session,
	onOpen,
}: {
	session: PlanSession;
	onOpen: () => void;
}) {
	const phase = PHASE_COLOR[session.phase];
	const title = formatGermanUiText(session.title);
	const goal = formatGermanUiText(session.goal);

	return (
		<View className="relative min-h-[184px]">
			<View
				className="min-h-[158px] rounded-[40px] border border-border bg-card px-6 pt-6 pb-8"
				style={{ marginRight: 28 }}
			>
				<View className="flex-row items-start justify-between gap-4">
					<Text
						className="max-w-[154px] font-poppins font-semibold text-[18px] text-foreground leading-[24px]"
						numberOfLines={2}
					>
						{title}
					</Text>

					<View className="flex-row items-center gap-1.5">
						<View
							className="flex-row items-center gap-1 rounded-full px-2.5 py-1.5"
							style={{ backgroundColor: phase.background }}
						>
							<Dumbbell size={12} color={phase.foreground} strokeWidth={2.1} />
							<Text
								className="font-poppins font-semibold text-[10px] leading-[12px]"
								style={{ color: phase.foreground }}
							>
								{PHASE_LABEL[session.phase]}
							</Text>
						</View>

						<View className="rounded-full bg-system-subtle px-3 py-1.5">
							<Text className="font-poppins font-semibold text-[10px] text-primary leading-[12px]">
								{`${session.durationMinutes} min`}
							</Text>
						</View>
					</View>
				</View>

				<View className="mt-4 flex-row items-center gap-1.5">
					<Clock3
						size={13}
						color={DAYOVA_DESIGN_SYSTEM.colors.textMuted}
						strokeWidth={2}
					/>
					<Text className="font-poppins text-[13px] text-muted-foreground leading-[18px]">
						{session.dateLabel}
					</Text>
				</View>

				<Text
					className="mt-3 max-w-[252px] font-poppins text-[15px] text-muted-foreground leading-[22px]"
					numberOfLines={2}
				>
					{goal}
				</Text>
			</View>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Lerneinheit öffnen"
				className="absolute right-0 bottom-0 h-[72px] w-[72px] overflow-hidden rounded-full"
				onPress={onOpen}
			>
				<LinearGradient
					colors={primaryGradient.colors}
					start={primaryGradient.start}
					end={primaryGradient.end}
					style={{
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<ArrowUpRight
						size={30}
						color={DAYOVA_DESIGN_SYSTEM.colors.primaryForeground}
						strokeWidth={2.2}
					/>
				</LinearGradient>
			</Pressable>
		</View>
	);
}

type PathNodeState = "completed" | "active" | "locked";

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

function PathNode({
	frame,
	state,
	onPress,
}: {
	frame: PathNodeFrame;
	state: PathNodeState;
	onPress: () => void;
}) {
	const isActive = state === "active";
	const isLocked = state === "locked";
	const activeNodeSize = 58;
	const completedNodeWidth = 72;
	const completedNodeHeight = 64;
	const lockedOuterWidth = 68;
	const lockedOuterHeight = 64;
	const lockedInnerSize = 58;
	const position = {
		left: frame.left,
		top: frame.top,
		width: frame.width,
		height: frame.height,
	} satisfies ViewStyle;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled: isLocked, selected: isActive }}
			disabled={isLocked}
			onPress={onPress}
			className="absolute items-center justify-center shadow-black/20 shadow-sm"
			style={position}
		>
			{isLocked ? (
				<View
					className="items-center justify-center rounded-full"
					style={{
						width: lockedOuterWidth,
						height: lockedOuterHeight,
						backgroundColor: "#E3EAF2",
					}}
				>
					<View
						className="items-center justify-center rounded-full"
						style={{
							width: lockedInnerSize,
							height: lockedInnerSize,
							backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.path3,
						}}
					>
						<Lock
							size={22}
							color={DAYOVA_DESIGN_SYSTEM.colors.primaryForeground}
							strokeWidth={2}
						/>
					</View>
				</View>
			) : isActive ? (
				<View
					className="overflow-hidden rounded-full"
					style={{ width: activeNodeSize, height: activeNodeSize }}
				>
					<LinearGradient
						colors={primaryGradient.colors}
						start={primaryGradient.start}
						end={primaryGradient.end}
						style={{
							flex: 1,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<NotebookPen
							size={22}
							color={DAYOVA_DESIGN_SYSTEM.colors.primaryForeground}
							strokeWidth={2.1}
						/>
					</LinearGradient>
				</View>
			) : (
				<View
					className="items-center justify-start"
					style={{ width: completedNodeWidth, height: completedNodeHeight }}
				>
					<View
						className="absolute top-2 rounded-full"
						style={{
							width: completedNodeWidth,
							height: completedNodeHeight - 2,
							backgroundColor: "#009DDE",
						}}
					/>
					<View
						className="overflow-hidden rounded-full"
						style={{
							width: completedNodeWidth,
							height: completedNodeHeight - 6,
							backgroundColor: "#10C5FF",
						}}
					>
						<View
							className="absolute top-6 left-6 h-4 w-11 -rotate-45"
							style={{
								backgroundColor: "rgba(111, 224, 249, 0.72)",
								borderBottomEndRadius: 6,
								borderBottomStartRadius: 6,
								borderTopLeftRadius: 3,
								borderTopRightRadius: 3,
							}}
						/>
						<View className="absolute top-3 -rotate-45 left-0 h-5 rounded-[2px] w-11 overflow-hidden">
							<View
								className="h-full w-full"
								style={{
									backgroundColor: "rgba(111, 224, 249, 0.62)",
									borderTopLeftRadius: 999,
									borderTopRightRadius: 999,
								}}
							/>
						</View>
						<View
							className="absolute items-center justify-center"
							style={{
								left: (completedNodeWidth - 35) / 2,
								top: (completedNodeHeight - 6 - 35) / 2,
								width: 35,
								height: 35,
							}}
						>
							<Check
								size={30}
								color={DAYOVA_DESIGN_SYSTEM.colors.primaryForeground}
								strokeWidth={2.5}
							/>
						</View>
					</View>
				</View>
			)}
		</Pressable>
	);
}

function LearningPath({
	planId,
	sessions,
}: {
	planId: Id<"learningPlans">;
	sessions: PlanSession[];
}) {
	const router = useRouter();
	const firstOpenIndex = sessions.findIndex((session) => !session.completed);
	const currentIndex =
		firstOpenIndex === -1 ? Math.max(sessions.length - 1, 0) : firstOpenIndex;
	const pathHeight = getFigmaPathHeight(sessions.length);
	const segments = sessions.slice(1).map((_, index) => ({
		d: getFigmaSegmentPath(index),
		active: index < currentIndex,
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
				const state: PathNodeState =
					index === currentIndex
						? "active"
						: index > currentIndex
							? "locked"
							: "completed";

				return (
					<PathNode
						key={session.id}
						frame={getFigmaNodeFrame(index)}
						state={state}
						onPress={() => router.push(getSessionRoute(planId, session.id))}
					/>
				);
			})}
		</View>
	);
}

export default function LearningPlanSessionsScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && planId ? { id: planId } : "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const currentSession =
		snapshot?.sessions.find((session) => !session.completed) ??
		snapshot?.sessions.at(-1) ??
		null;

	const goBack = () => {
		goBackOrReplace(router, "/learning-plans");
	};

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScreenScroll
				contentInsetAdjustmentBehavior="automatic"
				horizontalPadding={16}
				topPadding={46}
				bottomPadding={54}
				contentContainerStyle={screenContentStyle}
			>
				<ScreenHeader title="Lernplan" onBack={goBack} className="mb-0" />

				{snapshot === null ? (
					<View className="items-center py-16">
						<ActivityIndicator
							color={DAYOVA_DESIGN_SYSTEM.colors.primary}
							size="small"
						/>
					</View>
				) : currentSession ? (
					<>
						<SessionPreviewCard
							session={currentSession}
							onOpen={() =>
								router.push(
									getSessionRoute(snapshot.plan.id, currentSession.id),
								)
							}
						/>
						<LearningPath
							planId={snapshot.plan.id}
							sessions={snapshot.sessions}
						/>
					</>
				) : (
					<View className="items-center rounded-[28px] bg-card px-5 py-7">
						<Text className="text-center font-poppins font-semibold text-foreground">
							Keine Lerneinheiten vorhanden
						</Text>
					</View>
				)}
			</ScreenScroll>
		</Screen>
	);
}
