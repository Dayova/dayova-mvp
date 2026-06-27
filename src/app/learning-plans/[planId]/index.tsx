import { useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
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
	Check,
	Clock3,
	Dumbbell,
	NotebookPen,
	SquareLock,
} from "~/components/ui/icon";
import { CompactNotchedActionCard } from "~/components/ui/notched-action-card";
import { Screen } from "~/components/ui/screen";
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

const screenContentStyle = { rowGap: 28 } satisfies ViewStyle;
const SESSION_PREVIEW_CARD_HEIGHT = 174;
const SESSION_PREVIEW_CARD_PATH =
	"M40 1 H329 C351 1 368 18 368 40 V66 C368 87 350 102 324 102 C300 102 292 116 292 132 C292 163 284 171 272 174 H40 C18 174 1 157 1 135 V40 C1 18 18 1 40 1 Z";

const getSessionRoute = (
	planId: Id<"learningPlans">,
	sessionId: Id<"learningPlanSessions">,
) => `/learning-plans/${planId}/sessions/${sessionId}` as const;

function SessionPreviewCard({
	session,
	onOpen,
}: {
	session: PlanSession;
	onOpen: () => void;
}) {
	const phase = PHASE_COLOR[session.phase];
	const title = formatGermanUiText(session.title);
	const description = formatGermanUiText(session.goal);

	return (
		<CompactNotchedActionCard
			accessibilityHint="Öffnet die ausgewählte Lerneinheit."
			accessibilityLabel={`${title}, ${PHASE_LABEL[session.phase]}, ${session.durationMinutes} Minuten`}
			actionAccessibilityLabel="Lerneinheit öffnen"
			actionIcon={
				<ArrowUpRight
					size={24}
					color={DAYOVA_DESIGN_SYSTEM.colors.light1}
					strokeWidth={2.2}
				/>
			}
			actionOffsetBottom={4}
			onActionPress={onOpen}
			cardHeight={SESSION_PREVIEW_CARD_HEIGHT}
			cardPath={SESSION_PREVIEW_CARD_PATH}
			cardStyle={{
				paddingTop: 22,
				paddingRight: 24,
				paddingBottom: 24,
			}}
		>
			<View className="gap-2">
				<View className="flex-row items-start justify-between gap-3">
					<Text
						className="max-w-[170px] flex-1 font-poppins font-semibold text-[18px] text-foreground leading-[24px]"
						numberOfLines={2}
					>
						{title}
					</Text>

					<View className="flex-row items-center justify-end gap-1">
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

				<View className="flex-row items-center gap-1.5">
					<Clock3
						size={13}
						color={DAYOVA_DESIGN_SYSTEM.colors.secondaryText}
						strokeWidth={2}
					/>
					<Text className="font-poppins text-[13px] text-muted-foreground leading-[18px]">
						{session.dateLabel}
					</Text>
				</View>

				<Text
					className="max-w-[252px] font-poppins text-[15px] text-muted-foreground leading-[21px]"
					numberOfLines={2}
				>
					{description}
				</Text>
			</View>
		</CompactNotchedActionCard>
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
	const completedNodeWidth = 72;
	const completedNodeHeight = 64;
	const position = {
		left: frame.left,
		top: frame.top,
		width: frame.width,
		height: frame.height,
	} satisfies ViewStyle;

	const renderStepCircle = ({
		borderColor,
		icon,
		isDimmed = false,
		showHighlights = false,
	}: {
		borderColor?: string;
		icon: ReactNode;
		isDimmed?: boolean;
		showHighlights?: boolean;
	}) => {
		const backColor = isDimmed
			? DAYOVA_DESIGN_SYSTEM.colors.path1
			: DAYOVA_DESIGN_SYSTEM.colors.path5;
		const fillColor = isDimmed
			? DAYOVA_DESIGN_SYSTEM.colors.path3
			: DAYOVA_DESIGN_SYSTEM.colors.path6;

		return (
			<View
				className="items-center justify-start"
				style={{ width: completedNodeWidth, height: completedNodeHeight }}
			>
				<View
					className="absolute top-0.5 rounded-full"
					style={{
						width: completedNodeWidth - 2,
						height: completedNodeHeight - 3.5,
						backgroundColor: backColor,
					}}
				/>
				<View
					className="overflow-hidden rounded-full"
					style={{
						width: completedNodeWidth - 2,
						height: completedNodeHeight - 6,
						backgroundColor: fillColor,
						borderColor,
						borderWidth: borderColor ? 2 : 0,
					}}
				>
					{showHighlights ? (
						<>
							<View
								className="absolute top-6 left-6 h-4 w-11 -rotate-45"
								style={{
									backgroundColor: `${DAYOVA_DESIGN_SYSTEM.colors.path7}B8`,
									borderBottomEndRadius: 6,
									borderBottomStartRadius: 6,
									borderTopLeftRadius: 3,
									borderTopRightRadius: 3,
								}}
							/>
							<View className="absolute top-3 left-0 h-5 w-11 -rotate-45 overflow-hidden rounded-[2px]">
								<View
									className="h-full w-full"
									style={{
										backgroundColor: `${DAYOVA_DESIGN_SYSTEM.colors.path7}9E`,
										borderTopLeftRadius: 999,
										borderTopRightRadius: 999,
									}}
								/>
							</View>
						</>
					) : null}
					<View className="absolute inset-0 items-center justify-center">
						{icon}
					</View>
				</View>
			</View>
		);
	};

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: isActive }}
			onPress={onPress}
			className="absolute items-center justify-center shadow-black/20 shadow-sm"
			style={position}
		>
			{isLocked
				? renderStepCircle({
						borderColor: DAYOVA_DESIGN_SYSTEM.colors.path1,
						icon: (
							<SquareLock
								size={27}
								color={DAYOVA_DESIGN_SYSTEM.colors.light1}
								strokeWidth={1.9}
							/>
						),
						isDimmed: true,
					})
				: isActive
					? renderStepCircle({
							borderColor: DAYOVA_DESIGN_SYSTEM.colors.path5,
							icon: (
								<NotebookPen
									size={30}
									color={DAYOVA_DESIGN_SYSTEM.colors.light1}
									strokeWidth={1.8}
								/>
							),
						})
					: renderStepCircle({
							icon: (
								<Check
									size={30}
									color={DAYOVA_DESIGN_SYSTEM.colors.light1}
									strokeWidth={2.5}
								/>
							),
							showHighlights: true,
						})}
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
					session.id === selectedSessionId
						? "active"
						: index > currentIndex
							? "locked"
							: "completed";

				return (
					<PathNode
						key={session.id}
						frame={getFigmaNodeFrame(index)}
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

	const goBack = () => {
		goBackOrReplace(router, "/learning-plans");
	};

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
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
							color={DAYOVA_DESIGN_SYSTEM.colors.primary}
							size="small"
						/>
					</View>
				) : selectedSession ? (
					<SessionPreviewCard
						session={selectedSession}
						onOpen={() =>
							router.push(getSessionRoute(snapshot.plan.id, selectedSession.id))
						}
					/>
				) : (
					<View className="items-center rounded-[28px] bg-card px-5 py-7">
						<Text className="text-center font-poppins font-semibold text-foreground">
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
