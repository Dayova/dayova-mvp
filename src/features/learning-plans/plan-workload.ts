import { calculateAvailableStudyMinutes } from "#convex/learningPlanAvailability";
import {
	getDefaultPreparationDepth,
	type PreparationDepth,
	recommendLearningPreparation,
} from "#convex/learningPreparationPolicy";

export { calculateAvailableStudyMinutes };

const MIN_TOTAL_STUDY_MINUTES = 30;
const MAX_TOTAL_STUDY_MINUTES = 180;
export const MIN_ROLLING_HORIZON_MINUTES = 20;

const roundToTen = (minutes: number) => Math.round(minutes / 10) * 10;

export const shouldRequestLearningTimeBeforeExam = ({
	fromDateKey,
	examDateKey,
	learningTimes,
}: {
	fromDateKey: string;
	examDateKey: string;
	learningTimes: Array<{
		dayOfWeek: number;
		startTime: string;
		endTime: string;
	}>;
}) =>
	examDateKey > fromDateKey &&
	calculateAvailableStudyMinutes({
		fromDateKey,
		examDateKey,
		learningTimes,
	}) < MIN_ROLLING_HORIZON_MINUTES;

export const shouldShowLearningTimeValidation = ({
	fromDateKey,
	examDateKey,
}: {
	fromDateKey: string;
	examDateKey: string;
}) => examDateKey > fromDateKey;

export const getAutomaticLearningPreparation = ({
	examTypeLabel,
	examDurationMinutes,
	preparationDepth,
	topicCount,
	answerCount,
	topicReadiness,
	availableMinutes,
}: {
	examTypeLabel: string;
	examDurationMinutes: number;
	preparationDepth?: PreparationDepth;
	topicCount: number;
	answerCount: number;
	topicReadiness: Array<{
		status: "secure" | "developing" | "unknown";
	}>;
	availableMinutes: number;
}) => {
	const resolvedPreparationDepth =
		preparationDepth ?? getDefaultPreparationDepth(examTypeLabel);
	const assessedTopicCount = Math.max(topicCount, answerCount);
	const secure = topicReadiness.filter(
		(topic) => topic.status === "secure",
	).length;
	const developing = topicReadiness.filter(
		(topic) => topic.status === "developing",
	).length;
	const unknown = topicReadiness.filter(
		(topic) => topic.status === "unknown",
	).length;

	return {
		preparationDepth: resolvedPreparationDepth,
		recommendation: recommendLearningPreparation({
			examTypeLabel,
			examDurationMinutes,
			preparationDepth: resolvedPreparationDepth,
			topicReadiness: {
				secure,
				developing,
				unknown: Math.max(unknown, assessedTopicCount - topicReadiness.length),
			},
			availableMinutes,
		}),
	};
};

const isUncertainAnswer = (answer: string) => {
	const normalized = answer.trim().toLocaleLowerCase("de-DE");
	return (
		normalized.length <= 10 ||
		normalized.includes("weiß ich nicht") ||
		normalized.includes("weiss ich nicht") ||
		normalized.includes("keine ahnung") ||
		normalized.includes("unsicher")
	);
};

export const suggestTotalStudyMinutes = ({
	examDurationMinutes,
	answers,
	availableMinutes,
}: {
	examDurationMinutes: number;
	answers: string[];
	availableMinutes?: number | null;
}) => {
	const examBasedMinutes = Math.max(
		MIN_TOTAL_STUDY_MINUTES,
		roundToTen((Math.max(examDurationMinutes, 30) * 2) / 3),
	);
	const uncertaintyMinutes = Math.min(
		30,
		answers.filter(isUncertainAnswer).length * 10,
	);
	const suggestedMinutes = Math.min(
		MAX_TOTAL_STUDY_MINUTES,
		examBasedMinutes + uncertaintyMinutes,
	);

	if (availableMinutes === undefined || availableMinutes === null) {
		return suggestedMinutes;
	}
	if (availableMinutes < 10) return suggestedMinutes;
	return Math.min(suggestedMinutes, Math.floor(availableMinutes / 5) * 5);
};
