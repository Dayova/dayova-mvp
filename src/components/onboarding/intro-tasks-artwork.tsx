import { StyleSheet, View } from "react-native";
import type { SvgProps } from "react-native-svg";
import type { Id } from "#convex/_generated/dataModel";
import { SessionCard } from "~/features/learning-plans/learning-plan-ui";
import type { PlanSession } from "~/features/learning-plans/types";

const ARTWORK_WIDTH = 356;
const ARTWORK_HEIGHT = 242;

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

function numericDimension(
	value: SvgProps["width"] | SvgProps["height"],
	fallback: number,
) {
	return typeof value === "number" ? value : fallback;
}

export function IntroTasksArtwork({ width, height }: SvgProps) {
	const resolvedWidth = numericDimension(width, ARTWORK_WIDTH);
	const resolvedHeight = numericDimension(height, ARTWORK_HEIGHT);
	const scale = Math.min(
		resolvedWidth / ARTWORK_WIDTH,
		resolvedHeight / ARTWORK_HEIGHT,
	);

	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className="items-center justify-center"
			style={{ width: resolvedWidth, height: resolvedHeight }}
			testID="intro-tasks-artwork"
		>
			<View
				className="relative h-[242px] w-[356px]"
				style={{ transform: [{ scale }] }}
			>
				{learningSteps.map((session, index) => (
					<View
						key={session.id}
						style={[artworkGeometry.card, { top: index * 78 }]}
					>
						<SessionCard mode="artwork" session={session} />
					</View>
				))}
			</View>
		</View>
	);
}

const artworkGeometry = StyleSheet.create({
	card: {
		position: "absolute",
		left: 6,
		width: 344,
		transform: [{ scale: 0.74 }],
		transformOrigin: [0, 0, 0],
	},
});
