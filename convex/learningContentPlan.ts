export type LearningContentPhase = "theory" | "practice" | "rehearsal";

export type LearningTopicPriority = "high" | "medium" | "low";

export type LearningTopic = {
	id: string;
	title: string;
	learningGoal: string;
	keywords: string[];
	priority: LearningTopicPriority;
};

export type LearningQuestionAngle =
	| "recall"
	| "recognize"
	| "apply"
	| "findError"
	| "compare"
	| "examTransfer";

export type LearningQuestionKind =
	| "learnCard"
	| "multipleChoice"
	| "written"
	| "voice";

export type LearningQuestionBlueprint = {
	coverageKey: string;
	topic: LearningTopic;
	angle: LearningQuestionAngle;
	kind: LearningQuestionKind;
	estimatedSeconds: number;
};

export type LearningContentBlock = {
	index: number;
	phase: LearningContentPhase;
	durationMinutes: number;
	questions: LearningQuestionBlueprint[];
};

const MAX_BLOCK_MINUTES = 10;
const MIN_BLOCK_MINUTES = 5;

const priorityRank: Record<LearningTopicPriority, number> = {
	high: 0,
	medium: 1,
	low: 2,
};

const questionAngles: LearningQuestionAngle[] = [
	"recall",
	"recognize",
	"apply",
	"findError",
	"compare",
	"examTransfer",
];

const taskKinds: LearningQuestionKind[] = [
	"multipleChoice",
	"written",
	"voice",
];

const estimatedSecondsForKind: Record<LearningQuestionKind, number> = {
	learnCard: 40,
	multipleChoice: 20,
	written: 40,
	voice: 40,
};

const splitIntoBlockDurations = (durationMinutes: number) => {
	if (
		!Number.isInteger(durationMinutes) ||
		durationMinutes < MIN_BLOCK_MINUTES
	) {
		throw new Error("A learning segment must last at least five minutes.");
	}

	const durations: number[] = [];
	let remainingMinutes = durationMinutes;
	while (remainingMinutes > MAX_BLOCK_MINUTES) {
		const afterMaximumBlock = remainingMinutes - MAX_BLOCK_MINUTES;
		if (afterMaximumBlock > 0 && afterMaximumBlock < MIN_BLOCK_MINUTES) {
			durations.push(remainingMinutes - MIN_BLOCK_MINUTES);
			remainingMinutes = MIN_BLOCK_MINUTES;
			break;
		}
		durations.push(MAX_BLOCK_MINUTES);
		remainingMinutes = afterMaximumBlock;
	}

	if (remainingMinutes > 0) durations.push(remainingMinutes);
	return durations;
};

const questionKindFor = (
	phase: LearningContentPhase,
	questionIndex: number,
): LearningQuestionKind => {
	if (phase === "theory") return "learnCard";
	return taskKinds[questionIndex % taskKinds.length] ?? "written";
};

const createQuestions = ({
	phase,
	durationMinutes,
	topics,
	startIndex,
	excludedCoverageKeys,
}: {
	phase: LearningContentPhase;
	durationMinutes: number;
	topics: LearningTopic[];
	startIndex: number;
	excludedCoverageKeys: Set<string>;
}) => {
	const targetSeconds = durationMinutes * 60;
	const questions: LearningQuestionBlueprint[] = [];
	let plannedSeconds = 0;
	let questionIndex = startIndex;

	while (plannedSeconds < targetSeconds) {
		const globalIndex = questionIndex;
		questionIndex += 1;
		const topic = topics[globalIndex % topics.length];
		if (!topic)
			throw new Error("A learning content plan needs at least one topic.");
		const angle =
			questionAngles[
				Math.floor(globalIndex / topics.length) % questionAngles.length
			] ?? "apply";
		const cycle = Math.floor(
			globalIndex / Math.max(topics.length * questionAngles.length, 1),
		);
		const kind = questionKindFor(phase, questions.length);
		const estimatedSeconds = Math.min(
			estimatedSecondsForKind[kind],
			targetSeconds - plannedSeconds,
		);

		const coverageKey = `${topic.id}:${angle}:${cycle}`;
		if (excludedCoverageKeys.has(coverageKey)) continue;
		excludedCoverageKeys.add(coverageKey);
		questions.push({
			coverageKey,
			topic,
			angle,
			kind,
			estimatedSeconds,
		});
		plannedSeconds += estimatedSeconds;
	}

	return { questions, nextIndex: questionIndex };
};

export const createLearningContentPlan = ({
	segments,
	topics,
	excludedCoverageKeys = [],
	blockIndexOffset = 0,
}: {
	segments: Array<{
		phase: LearningContentPhase;
		durationMinutes: number;
	}>;
	topics: LearningTopic[];
	excludedCoverageKeys?: string[];
	blockIndexOffset?: number;
}) => {
	const orderedTopics = topics
		.filter((topic) => topic.id.trim() && topic.title.trim())
		.slice()
		.sort(
			(left, right) =>
				priorityRank[left.priority] - priorityRank[right.priority] ||
				left.title.localeCompare(right.title, "de"),
		);
	if (orderedTopics.length === 0) {
		throw new Error("A learning content plan needs at least one topic.");
	}

	const blocks: LearningContentBlock[] = [];
	let questionOffset = 0;
	const excludedKeys = new Set(excludedCoverageKeys);
	for (const segment of segments) {
		for (const durationMinutes of splitIntoBlockDurations(
			segment.durationMinutes,
		)) {
			const result = createQuestions({
				phase: segment.phase,
				durationMinutes,
				topics: orderedTopics,
				startIndex: questionOffset,
				excludedCoverageKeys: excludedKeys,
			});
			blocks.push({
				index: blockIndexOffset + blocks.length,
				phase: segment.phase,
				durationMinutes,
				questions: result.questions,
			});
			questionOffset = result.nextIndex;
		}
	}

	return { blocks };
};
