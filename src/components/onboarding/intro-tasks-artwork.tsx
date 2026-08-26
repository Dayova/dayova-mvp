import { View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { SessionCard } from "~/features/learning-plans/learning-plan-ui";
import type { PlanSession } from "~/features/learning-plans/types";

const ARTWORK_WIDTH = 356;
const ARTWORK_HEIGHT = 242;

type IntroTasksArtworkProps = {
	height?: number;
	width?: number;
};

const learningSteps: PlanSession[] = [
	{
		id: "intro-session-theory" as Id<"learningPlanSessions">,
		phase: "theory",
		title: "Lineare Funktionen verstehen",
		dateKey: "2026-08-17",
		dateLabel: "Montag, 17. August",
		startTime: "16:30",
		durationMinutes: 30,
		goal: "Grundlagen verstehen",
		tasks: [],
		expectedOutcome: "Die Grundlagen sind klar.",
		sortOrder: 0,
		completed: false,
		executionStatus: "notStarted",
	},
	{
		id: "intro-session-practice" as Id<"learningPlanSessions">,
		phase: "practice",
		title: "Steigung berechnen",
		dateKey: "2026-08-19",
		dateLabel: "Mittwoch, 19. August",
		startTime: "16:30",
		durationMinutes: 30,
		goal: "Aufgaben sicher lösen",
		tasks: [],
		expectedOutcome: "Die Rechenschritte sitzen.",
		sortOrder: 1,
		completed: false,
		executionStatus: "notStarted",
	},
	{
		id: "intro-session-rehearsal" as Id<"learningPlanSessions">,
		phase: "rehearsal",
		title: "Prüfungsaufgaben trainieren",
		dateKey: "2026-08-22",
		dateLabel: "Samstag, 22. August",
		startTime: "10:00",
		durationMinutes: 30,
		goal: "Sicher in die Prüfung gehen",
		tasks: [],
		expectedOutcome: "Die Prüfung kann kommen.",
		sortOrder: 2,
		completed: false,
		executionStatus: "notStarted",
	},
];

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
			className="items-center justify-center"
			// The artwork frame dimensions are runtime component inputs.
			style={{ width, height }}
			testID="intro-tasks-artwork"
		>
			<View
				className="h-[242px] w-[356px] items-center justify-center"
				// The fixed artboard scales to the runtime frame while preserving its geometry.
				style={{ transform: [{ scale }] }}
			>
				<View className="w-[336px] gap-2" testID="intro-tasks-card-stack">
					{learningSteps.map((session, index) => (
						<SessionCard
							key={session.id}
							mode="artwork"
							session={session}
							testID={`intro-task-card-${index + 1}`}
						/>
					))}
				</View>
			</View>
		</View>
	);
}
