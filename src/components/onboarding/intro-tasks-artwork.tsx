import { StyleSheet, View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import {
	type DashboardWeekProgress,
	toDashboardAgendaItem,
} from "~/features/dashboard/dashboard-agenda";
import {
	DashboardAgendaEntryCard,
	DashboardNextStepCard,
	DashboardWeeklyProgressCard,
} from "~/features/dashboard/dashboard-product-cards";

const ARTWORK_WIDTH = 356;
const ARTWORK_HEIGHT = 242;
const PREVIEW_DAY_KEY = "2026-08-31";

type IntroTasksArtworkProps = {
	height?: number;
	width?: number;
};

const agendaPreview = toDashboardAgendaItem(PREVIEW_DAY_KEY, {
	id: "intro-dashboard-task" as Id<"dayEntries">,
	title: "Mathe lernen",
	kind: "Hausaufgabe",
	notes: "Funktionen üben",
	time: "15:30",
	durationMinutes: 30,
});

const nextStepPreview = toDashboardAgendaItem(PREVIEW_DAY_KEY, {
	id: "intro-dashboard-next-step" as Id<"learningPlanSessions">,
	relatedLearningPlanSessionId:
		"intro-dashboard-next-step" as Id<"learningPlanSessions">,
	title: "Lineare Funktionen verstehen",
	kind: "Lernsession",
	time: "16:30",
	durationMinutes: 30,
	executionStatus: "notStarted",
});

const progressPreview = {
	completedLearningSessions: 4,
	completedMinutesToday: 30,
	completionPercent: 57,
	remainingLearningSessions: 3,
	totalLearningSessions: 7,
} satisfies DashboardWeekProgress;

export function IntroTasksArtwork({
	width = ARTWORK_WIDTH,
	height = ARTWORK_HEIGHT,
}: IntroTasksArtworkProps) {
	const scale = Math.min(width / ARTWORK_WIDTH, height / ARTWORK_HEIGHT);

	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			className="items-center justify-center"
			// The artwork frame dimensions are runtime component inputs.
			style={{ width, height }}
			testID="intro-tasks-artwork"
		>
			<View
				className="h-[242px] w-[356px]"
				// The fixed artboard scales to the runtime frame while preserving its geometry.
				style={{ transform: [{ scale }] }}
				testID="intro-tasks-product-composition"
			>
				<View
					className="absolute shadow-black/10 shadow-lg"
					style={artworkGeometry.agenda}
					testID="intro-tasks-agenda-layer"
				>
					<DashboardAgendaEntryCard
						mode="artwork"
						item={agendaPreview}
						testID="intro-task-agenda-card"
					/>
				</View>
				<View
					className="absolute shadow-black/10 shadow-lg"
					style={artworkGeometry.progress}
					testID="intro-tasks-progress-layer"
				>
					<DashboardWeeklyProgressCard
						mode="artwork"
						progress={progressPreview}
						testID="intro-task-progress-card"
					/>
				</View>
				<View
					className="absolute shadow-black/15 shadow-xl"
					style={artworkGeometry.nextStep}
					testID="intro-tasks-next-step-layer"
				>
					<DashboardNextStepCard
						mode="artwork"
						item={nextStepPreview}
						todayKey={PREVIEW_DAY_KEY}
						testID="intro-task-next-step-card"
					/>
				</View>
			</View>
		</View>
	);
}

// The onboarding wrapper owns only the overlap, rotation, scale, and shadow.
// Product structure and tokens stay inside the shared dashboard components.
const artworkGeometry = StyleSheet.create({
	agenda: {
		left: 6,
		top: 42,
		width: 202,
		height: 106,
		transform: [{ rotate: "-10deg" }],
		transformOrigin: [0, 0, 0],
	},
	progress: {
		left: 188,
		top: 14,
		width: 164,
		height: 134,
		transform: [{ rotate: "7deg" }],
		transformOrigin: [0, 0, 0],
	},
	nextStep: {
		left: 32,
		top: 120,
		zIndex: 2,
		width: 292,
		height: 114,
	},
});
