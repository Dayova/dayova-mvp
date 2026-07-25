import type { LearningTopic } from "./learningContentPlan";
import {
	compactLearningSessionTitle,
	formatLearningTimeFromMinutes,
	parseLearningTimeToMinutes,
} from "./learningSessionScheduleFormatting";

export type SchedulableLearningSession<TPhase extends string = string> = {
	phase: TPhase;
	title: string;
	dateKey: string;
	dateLabel: string;
	startTime: string;
	durationMinutes: number;
	goal: string;
	tasks: string[];
	expectedOutcome: string;
};

export type LearningSessionPhase = "theory" | "practice" | "rehearsal";

type PhaseMetadata = Pick<
	SchedulableLearningSession<LearningSessionPhase>,
	"title" | "goal" | "tasks" | "expectedOutcome"
>;

const MIN_THEORY_SESSION_MINUTES = 5;
const MAX_THEORY_SESSION_MINUTES = 10;
const MIN_THEORY_SESSION_COUNT = 3;
const MAX_THEORY_SESSION_COUNT = 5;

const theorySessionStages = [
	{ title: "Grundlagen", verb: "Erarbeite" },
	{ title: "Vertiefung", verb: "Vertiefe" },
	{ title: "Transfer", verb: "Übertrage" },
	{ title: "Fehlercheck", verb: "Prüfe" },
	{ title: "Sicherung", verb: "Sichere" },
] as const;

const splitDurationEvenly = (durationMinutes: number, sessionCount: number) => {
	const baseDuration = Math.floor(durationMinutes / sessionCount);
	const extraMinutes = durationMinutes % sessionCount;
	return Array.from(
		{ length: sessionCount },
		(_, index) => baseDuration + (index < extraMinutes ? 1 : 0),
	);
};

const getTheoryDurationsBySession = ({
	sessions,
	maxSessions,
}: {
	sessions: SchedulableLearningSession<LearningSessionPhase>[];
	maxSessions: number;
}) => {
	const theorySources = sessions
		.map((session, index) => ({ session, index }))
		.filter(({ session }) => session.phase === "theory");
	const availableTheorySessionCount = Math.max(
		0,
		maxSessions - (sessions.length - theorySources.length),
	);
	const requiredCountForMaximumDuration = theorySources.reduce(
		(total, { session }) =>
			total + Math.ceil(session.durationMinutes / MAX_THEORY_SESSION_MINUTES),
		0,
	);
	const targetCount = Math.min(
		MAX_THEORY_SESSION_COUNT,
		availableTheorySessionCount,
		Math.max(
			MIN_THEORY_SESSION_COUNT,
			theorySources.length,
			requiredCountForMaximumDuration,
		),
	);
	const fragmentCounts = theorySources.map(({ session }) =>
		Math.max(
			1,
			Math.ceil(session.durationMinutes / MAX_THEORY_SESSION_MINUTES),
		),
	);
	let fragmentCount = fragmentCounts.reduce((total, count) => total + count, 0);
	while (fragmentCount < targetCount) {
		const sourceIndex = theorySources.findIndex(
			({ session }, index) =>
				(fragmentCounts[index] ?? 1) <
				Math.floor(session.durationMinutes / MIN_THEORY_SESSION_MINUTES),
		);
		if (sourceIndex < 0) break;
		fragmentCounts[sourceIndex] = (fragmentCounts[sourceIndex] ?? 1) + 1;
		fragmentCount += 1;
	}

	return new Map(
		theorySources.map(({ session, index }, sourceIndex) => [
			index,
			splitDurationEvenly(
				session.durationMinutes,
				fragmentCounts[sourceIndex] ?? 1,
			),
		]),
	);
};

export const rebalanceLearningPhases = ({
	sessions,
	phaseFallbacks,
}: {
	sessions: SchedulableLearningSession<LearningSessionPhase>[];
	phaseFallbacks: Record<LearningSessionPhase, PhaseMetadata>;
}) => {
	const totalMinutes = sessions.reduce(
		(total, session) => total + session.durationMinutes,
		0,
	);
	if (totalMinutes < 25) return sessions;

	const theoryMinutes = Math.min(30, totalMinutes - 10);
	const remainingMinutes = totalMinutes - theoryMinutes;
	const rehearsalMinutes = remainingMinutes >= 20 ? 10 : 5;
	const phaseMinutes: Record<LearningSessionPhase, number> = {
		theory: theoryMinutes,
		practice: remainingMinutes - rehearsalMinutes,
		rehearsal: rehearsalMinutes,
	};
	const result: SchedulableLearningSession<LearningSessionPhase>[] = [];
	const phases: LearningSessionPhase[] = ["theory", "practice", "rehearsal"];
	let phaseIndex = 0;

	for (const session of sessions) {
		let unallocatedMinutes = session.durationMinutes;
		let startMinutes = parseLearningTimeToMinutes(session.startTime) ?? 0;
		while (unallocatedMinutes > 0 && phaseIndex < phases.length) {
			const phase = phases[phaseIndex];
			if (!phase) break;
			if (phaseMinutes[phase] <= 0) {
				phaseIndex += 1;
				continue;
			}

			const durationMinutes = Math.min(unallocatedMinutes, phaseMinutes[phase]);
			const metadata =
				session.phase === phase ? session : phaseFallbacks[phase];
			result.push({
				...session,
				...metadata,
				phase,
				startTime: formatLearningTimeFromMinutes(startMinutes),
				durationMinutes,
			});
			phaseMinutes[phase] -= durationMinutes;
			unallocatedMinutes -= durationMinutes;
			startMinutes += durationMinutes;
		}
	}

	let retainedTheorySessionCount = 0;
	return result.map((session) => {
		if (session.phase !== "theory") return session;
		retainedTheorySessionCount += 1;
		if (retainedTheorySessionCount <= MAX_THEORY_SESSION_COUNT) return session;

		return {
			...session,
			...phaseFallbacks.practice,
			phase: "practice" as const,
		};
	});
};

export const splitLargeTheorySessions = ({
	sessions,
	topics,
	maxSessions,
	maxTitleChars,
}: {
	sessions: SchedulableLearningSession<LearningSessionPhase>[];
	topics: LearningTopic[];
	maxSessions: number;
	maxTitleChars: number;
}) => {
	const result: SchedulableLearningSession<LearningSessionPhase>[] = [];
	let theoryTopicIndex = 0;
	const theoryDurationsBySession = getTheoryDurationsBySession({
		sessions,
		maxSessions,
	});
	const totalTheoryFragmentCount = Array.from(
		theoryDurationsBySession.values(),
	).reduce((total, durations) => total + durations.length, 0);
	const distinctTopicTitleCount = new Set(
		topics.map((topic) => topic.title.trim().toLocaleLowerCase("de")),
	).size;
	const customizeTheoryMetadata = totalTheoryFragmentCount > 1;

	for (const [sessionIndex, session] of sessions.entries()) {
		const durations = theoryDurationsBySession.get(sessionIndex) ?? [
			session.durationMinutes,
		];
		let startMinutes = parseLearningTimeToMinutes(session.startTime) ?? 0;

		for (const [fragmentIndex, durationMinutes] of durations.entries()) {
			if (
				session.phase !== "theory" ||
				(durations.length === 1 && !customizeTheoryMetadata)
			) {
				result.push(session);
				if (session.phase === "theory") theoryTopicIndex += 1;
				break;
			}

			const topic = topics[theoryTopicIndex % Math.max(topics.length, 1)];
			const stage =
				theorySessionStages[theoryTopicIndex % theorySessionStages.length] ??
				theorySessionStages[0];
			const repeatsTopic = distinctTopicTitleCount < totalTheoryFragmentCount;
			const topicTitle = topic?.title || session.title;
			const topicGoal = topic?.learningGoal || session.goal;
			const title = repeatsTopic ? `${stage.title}: ${topicTitle}` : topicTitle;
			const goal = `${stage.verb} ${topicTitle}: ${topicGoal.replace(/[.!?]+$/, "")}.`;
			const sourceTask =
				session.tasks[fragmentIndex % Math.max(session.tasks.length, 1)];

			result.push({
				...session,
				title:
					compactLearningSessionTitle(title, maxTitleChars) || session.title,
				startTime: formatLearningTimeFromMinutes(startMinutes),
				durationMinutes,
				goal,
				tasks: [
					`${stage.verb} das Lernziel zu ${topicTitle}.`,
					...(sourceTask ? [sourceTask] : []),
				],
				expectedOutcome: `Du hast ${topicTitle} im Schritt „${stage.title}“ abgeschlossen.`,
			});
			startMinutes += durationMinutes;
			theoryTopicIndex += 1;
		}
	}

	return result;
};
