import { ActivityIndicator, View } from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	useReducedMotion,
} from "react-native-reanimated";
import { Button } from "~/components/ui/button";
import {
	ArrowRight,
	Check,
	CircleAlert,
	Dumbbell,
	Note,
	Repeat,
	Sparkles,
	Time04,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import {
	LEARNING_PATH_PHASE_ICON,
	type LearningPathNodeIcon,
} from "~/features/learning-plans/learning-path-node-presentation";
import {
	isDiagnosticLearningPlanSession,
	isLearningPlanSessionHistory,
} from "~/features/learning-plans/rolling-learning-window";
import type { PlanSession } from "~/features/learning-plans/types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
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

const SESSION_PREVIEW_TRANSITION_DURATION_MS = 160;

export function SessionPreviewCard({
	canOpen,
	onRetryPreparation,
	preparationState,
	session,
	onOpen,
	actionLabelOverride,
}: {
	canOpen: boolean;
	actionLabelOverride?: string;
	onRetryPreparation?: () => void;
	preparationState?: "preparing" | "failed";
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
	const actionLabel =
		actionLabelOverride ??
		(hasRecordedOutcome
			? "Ansehen"
			: session.executionStatus === "started"
				? "Weiterlernen"
				: "Starten");
	const content = (
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
					{session.unscheduled
						? "Jederzeit starten"
						: `${session.dateLabel} · ${session.startTime}`}
				</Text>
			</View>

			<Text
				className="font-poppins text-body-4 text-secondary-text"
				numberOfLines={2}
			>
				{description}
			</Text>
			{preparationState === "preparing" ? (
				<View
					accessible
					accessibilityLiveRegion="polite"
					className="mt-1 flex-row items-center gap-3 rounded-[20px] bg-system-subtle px-3 py-3"
				>
					<ActivityIndicator
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						size="small"
					/>
					<View className="min-w-0 flex-1">
						<Text className="font-poppins font-semibold text-body-5 text-text">
							Lerninhalte werden vorbereitet
						</Text>
						<Text className="mt-0.5 font-poppins text-body-5 text-secondary-text">
							Du kannst den Plan verlassen. Dayova arbeitet im Hintergrund
							weiter.
						</Text>
					</View>
				</View>
			) : preparationState === "failed" ? (
				<View className="mt-1 gap-3 rounded-[20px] bg-wrong-subtle px-3 py-3">
					<View className="flex-row items-start gap-2">
						<CircleAlert
							size={17}
							color={DAYOVA_DESIGN_SYSTEM.colors.wrong}
							strokeWidth={2.1}
						/>
						<Text className="min-w-0 flex-1 font-poppins text-body-5 text-secondary-text">
							Die Lerninhalte konnten noch nicht vorbereitet werden.
						</Text>
					</View>
					<Button
						accessibilityLabel={`Vorbereitung erneut versuchen: ${title}`}
						onPress={onRetryPreparation}
						size="sm"
						variant="neutral"
					>
						<Text>Erneut versuchen</Text>
					</Button>
				</View>
			) : canOpen ? (
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
