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

const MIN_PHASE_SESSION_MINUTES = 5;
const MAX_THEORY_SESSION_MINUTES = 10;
const MAX_PRACTICE_SESSION_MINUTES = 20;
const MAX_REHEARSAL_SESSION_MINUTES = 20;
const TARGET_THEORY_SHARE = 0.22;
const TARGET_REHEARSAL_SHARE = 0.22;

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

const splitPhaseDuration = (durationMinutes: number, maxMinutes: number) => {
	if (durationMinutes <= 0) return [];
	const chunkCount = Math.ceil(durationMinutes / maxMinutes);
	return splitDurationEvenly(durationMinutes, chunkCount);
};

const roundToFiveMinutes = (durationMinutes: number) =>
	Math.max(
		MIN_PHASE_SESSION_MINUTES,
		Math.round(durationMinutes / MIN_PHASE_SESSION_MINUTES) *
			MIN_PHASE_SESSION_MINUTES,
	);

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
	const theoryMinutes = Math.max(
		MAX_THEORY_SESSION_MINUTES,
		roundToFiveMinutes(totalMinutes * TARGET_THEORY_SHARE),
	);
	const rehearsalMinutes = roundToFiveMinutes(
		totalMinutes * TARGET_REHEARSAL_SHARE,
	);
	const phaseMinutes: Record<LearningSessionPhase, number> = {
		theory: theoryMinutes,
		practice: totalMinutes - theoryMinutes - rehearsalMinutes,
		rehearsal: rehearsalMinutes,
	};
	const theoryChunks = splitPhaseDuration(
		phaseMinutes.theory,
		MAX_THEORY_SESSION_MINUTES,
	);
	const practiceChunks = splitPhaseDuration(
		phaseMinutes.practice,
		MAX_PRACTICE_SESSION_MINUTES,
	);
	const rehearsalChunks = splitPhaseDuration(
		phaseMinutes.rehearsal,
		MAX_REHEARSAL_SESSION_MINUTES,
	);
	const desiredChunks: Array<{
		phase: LearningSessionPhase;
		durationMinutes: number;
	}> = [];
	while (theoryChunks.length > 0 || practiceChunks.length > 0) {
		const theoryDuration = theoryChunks.shift();
		if (theoryDuration !== undefined) {
			desiredChunks.push({ phase: "theory", durationMinutes: theoryDuration });
		}
		const practiceDuration = practiceChunks.shift();
		if (practiceDuration !== undefined) {
			desiredChunks.push({
				phase: "practice",
				durationMinutes: practiceDuration,
			});
		}
	}
	desiredChunks.push(
		...rehearsalChunks.map((durationMinutes) => ({
			phase: "rehearsal" as const,
			durationMinutes,
		})),
	);
	const borrowFromFollowingChunks = (afterIndex: number, minutes: number) => {
		let remaining = minutes;
		for (
			let index = afterIndex + 1;
			index < desiredChunks.length && remaining > 0;
			index += 1
		) {
			const chunk = desiredChunks[index];
			if (!chunk) continue;
			const borrowed = Math.min(chunk.durationMinutes, remaining);
			chunk.durationMinutes -= borrowed;
			remaining -= borrowed;
		}
		return minutes - remaining;
	};

	const result: SchedulableLearningSession<LearningSessionPhase>[] = [];
	let chunkIndex = 0;
	let remainingChunkMinutes = desiredChunks[0]?.durationMinutes ?? 0;
	const maximumDurationByPhase: Record<LearningSessionPhase, number> = {
		theory: MAX_THEORY_SESSION_MINUTES,
		practice: MAX_PRACTICE_SESSION_MINUTES,
		rehearsal: MAX_REHEARSAL_SESSION_MINUTES,
	};

	for (const session of sessions) {
		let unallocatedMinutes = session.durationMinutes;
		let startMinutes = parseLearningTimeToMinutes(session.startTime) ?? 0;
		while (unallocatedMinutes > 0 && chunkIndex < desiredChunks.length) {
			if (remainingChunkMinutes <= 0) {
				chunkIndex += 1;
				remainingChunkMinutes = desiredChunks[chunkIndex]?.durationMinutes ?? 0;
				continue;
			}
			const chunk = desiredChunks[chunkIndex];
			if (!chunk) break;
			const phase = chunk.phase;
			let durationMinutes = Math.min(unallocatedMinutes, remainingChunkMinutes);
			const completesChunk = durationMinutes === remainingChunkMinutes;
			const trailingMinutes = unallocatedMinutes - durationMinutes;
			if (
				completesChunk &&
				durationMinutes < MIN_PHASE_SESSION_MINUTES &&
				unallocatedMinutes >= MIN_PHASE_SESSION_MINUTES
			) {
				const needed = MIN_PHASE_SESSION_MINUTES - durationMinutes;
				const borrowed = borrowFromFollowingChunks(chunkIndex, needed);
				durationMinutes += borrowed;
			} else if (
				completesChunk &&
				trailingMinutes > 0 &&
				trailingMinutes < MIN_PHASE_SESSION_MINUTES &&
				durationMinutes + trailingMinutes <= maximumDurationByPhase[chunk.phase]
			) {
				const borrowed = borrowFromFollowingChunks(chunkIndex, trailingMinutes);
				durationMinutes += borrowed;
			}
			const metadata =
				session.phase === phase ? session : phaseFallbacks[phase];
			result.push({
				...session,
				...metadata,
				phase,
				startTime: formatLearningTimeFromMinutes(startMinutes),
				durationMinutes,
			});
			unallocatedMinutes -= durationMinutes;
			remainingChunkMinutes = Math.max(
				0,
				remainingChunkMinutes - durationMinutes,
			);
			startMinutes += durationMinutes;
			if (remainingChunkMinutes === 0) {
				chunkIndex += 1;
				remainingChunkMinutes = desiredChunks[chunkIndex]?.durationMinutes ?? 0;
			}
		}
	}
	const mergedSessions = result.reduce<
		SchedulableLearningSession<LearningSessionPhase>[]
	>((merged, session) => {
		const previous = merged.at(-1);
		const previousStart = previous
			? parseLearningTimeToMinutes(previous.startTime)
			: null;
		const sessionStart = parseLearningTimeToMinutes(session.startTime);
		if (
			previous &&
			previous.phase === session.phase &&
			previous.dateKey === session.dateKey &&
			previousStart !== null &&
			sessionStart !== null &&
			previousStart + previous.durationMinutes === sessionStart &&
			previous.durationMinutes + session.durationMinutes <=
				maximumDurationByPhase[session.phase]
		) {
			previous.durationMinutes += session.durationMinutes;
			return merged;
		}
		merged.push(session);
		return merged;
	}, []);
	const minimumSizedSessions: SchedulableLearningSession<LearningSessionPhase>[] =
		[];
	const mergeCandidates = mergedSessions.map((session) => ({ ...session }));
	for (const [index, candidate] of mergeCandidates.entries()) {
		let session = candidate;
		if (session.durationMinutes >= MIN_PHASE_SESSION_MINUTES) {
			minimumSizedSessions.push(session);
			continue;
		}
		if (session.phase === "theory") {
			session = {
				...session,
				...phaseFallbacks.practice,
				phase: "practice",
			};
			mergeCandidates[index] = session;
		}
		const next = mergeCandidates[index + 1];
		const sessionStart = parseLearningTimeToMinutes(session.startTime);
		const nextStart = next ? parseLearningTimeToMinutes(next.startTime) : null;
		if (
			next &&
			next.phase === session.phase &&
			next.dateKey === session.dateKey &&
			sessionStart !== null &&
			nextStart === sessionStart + session.durationMinutes
		) {
			const [firstDuration, secondDuration] = splitDurationEvenly(
				session.durationMinutes + next.durationMinutes,
				2,
			);
			if (
				firstDuration !== undefined &&
				secondDuration !== undefined &&
				firstDuration >= MIN_PHASE_SESSION_MINUTES &&
				secondDuration >= MIN_PHASE_SESSION_MINUTES &&
				firstDuration <= maximumDurationByPhase[session.phase] &&
				secondDuration <= maximumDurationByPhase[next.phase]
			) {
				session.durationMinutes = firstDuration;
				next.startTime = formatLearningTimeFromMinutes(
					sessionStart + firstDuration,
				);
				next.durationMinutes = secondDuration;
				minimumSizedSessions.push(session);
				continue;
			}
		}
		const previous = minimumSizedSessions.at(-1);
		const previousStart = previous
			? parseLearningTimeToMinutes(previous.startTime)
			: null;
		if (
			previous &&
			previous.phase === session.phase &&
			previous.dateKey === session.dateKey &&
			previousStart !== null &&
			sessionStart !== null &&
			previousStart + previous.durationMinutes === sessionStart
		) {
			const [firstDuration, secondDuration] = splitDurationEvenly(
				previous.durationMinutes + session.durationMinutes,
				2,
			);
			if (
				firstDuration !== undefined &&
				secondDuration !== undefined &&
				firstDuration >= MIN_PHASE_SESSION_MINUTES &&
				secondDuration >= MIN_PHASE_SESSION_MINUTES &&
				firstDuration <= maximumDurationByPhase[previous.phase] &&
				secondDuration <= maximumDurationByPhase[session.phase]
			) {
				previous.durationMinutes = firstDuration;
				session.startTime = formatLearningTimeFromMinutes(
					previousStart + firstDuration,
				);
				session.durationMinutes = secondDuration;
				minimumSizedSessions.push(session);
				continue;
			}
		}
		if (
			previous &&
			previous.dateKey === session.dateKey &&
			previousStart !== null &&
			sessionStart !== null &&
			previousStart + previous.durationMinutes === sessionStart &&
			previous.durationMinutes + session.durationMinutes <=
				maximumDurationByPhase[previous.phase]
		) {
			previous.durationMinutes += session.durationMinutes;
			continue;
		}
		if (
			next &&
			next.dateKey === session.dateKey &&
			sessionStart !== null &&
			nextStart === sessionStart + session.durationMinutes &&
			next.durationMinutes + session.durationMinutes <=
				maximumDurationByPhase[next.phase]
		) {
			next.startTime = session.startTime;
			next.durationMinutes += session.durationMinutes;
			continue;
		}
		minimumSizedSessions.push(session);
	}
	let previousPhase: LearningSessionPhase | null = null;
	let displacedTheoryMinutes = 0;
	const withoutConsecutiveTheory = minimumSizedSessions.map((session) => {
		if (session.phase === "theory" && previousPhase === "theory") {
			displacedTheoryMinutes += session.durationMinutes;
			previousPhase = "practice";
			return {
				...session,
				...phaseFallbacks.practice,
				phase: "practice" as const,
			};
		}
		previousPhase = session.phase;
		return session;
	});
	const restoredSessions: SchedulableLearningSession<LearningSessionPhase>[] =
		[];
	for (const [index, session] of withoutConsecutiveTheory.entries()) {
		const previous = restoredSessions.at(-1);
		const next = withoutConsecutiveTheory[index + 1];
		const availableTheoryMinutes = Math.min(
			MAX_THEORY_SESSION_MINUTES,
			displacedTheoryMinutes,
			session.durationMinutes - MIN_PHASE_SESSION_MINUTES,
		);
		if (
			session.phase === "practice" &&
			availableTheoryMinutes >= MIN_PHASE_SESSION_MINUTES &&
			previous?.phase !== "theory" &&
			next?.phase !== "theory"
		) {
			restoredSessions.push({
				...session,
				...phaseFallbacks.theory,
				phase: "theory",
				durationMinutes: availableTheoryMinutes,
			});
			restoredSessions.push({
				...session,
				startTime: formatLearningTimeFromMinutes(
					(parseLearningTimeToMinutes(session.startTime) ?? 0) +
						availableTheoryMinutes,
				),
				durationMinutes: session.durationMinutes - availableTheoryMinutes,
			});
			displacedTheoryMinutes -= availableTheoryMinutes;
			continue;
		}
		restoredSessions.push(session);
	}
	return restoredSessions;
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
	void maxSessions;
	const theorySessionCount = sessions.filter(
		(session) => session.phase === "theory",
	).length;
	let theoryTopicIndex = 0;
	const distinctTopicTitleCount = new Set(
		topics.map((topic) => topic.title.trim().toLocaleLowerCase("de")),
	).size;
	return sessions.map((session) => {
		if (session.phase !== "theory" || theorySessionCount === 1) return session;
		const topic = topics[theoryTopicIndex % Math.max(topics.length, 1)];
		const stage =
			theorySessionStages[theoryTopicIndex % theorySessionStages.length] ??
			theorySessionStages[0];
		const repeatsTopic = distinctTopicTitleCount < theorySessionCount;
		const topicTitle = topic?.title || session.title;
		const topicGoal = topic?.learningGoal || session.goal;
		const title = repeatsTopic ? `${stage.title}: ${topicTitle}` : topicTitle;
		const sourceTask = session.tasks[0];
		theoryTopicIndex += 1;
		return {
			...session,
			title: compactLearningSessionTitle(title, maxTitleChars) || session.title,
			goal: `${stage.verb} ${topicTitle}: ${topicGoal.replace(/[.!?]+$/, "")}.`,
			tasks: [
				`${stage.verb} das Lernziel zu ${topicTitle}.`,
				...(sourceTask ? [sourceTask] : []),
			],
			expectedOutcome: `Du hast ${topicTitle} im Schritt „${stage.title}“ abgeschlossen.`,
		};
	});
};
