export type PreparationDepth = "compact" | "thorough" | "intensive";

export type TopicReadinessCounts = {
	secure: number;
	developing: number;
	unknown: number;
};

export type LearningPreparationRecommendation = {
	recommendedMinutes: number;
	minimumMinutes: number;
	plannedMinutes: number;
	preparationGapMinutes: number;
	praxisSessionCount: number;
};

const MAX_RECOMMENDED_MINUTES = 600;

const normalizedExamType = (value: string) =>
	value.trim().toLocaleLowerCase("de-DE");

const isSmallTest = (examTypeLabel: string) => {
	const value = normalizedExamType(examTypeLabel);
	return (
		value === "test" || value.includes("kurzkontrolle") || value === "quiz"
	);
};

const isMajorWrittenAssessment = (examTypeLabel: string) => {
	const value = normalizedExamType(examTypeLabel);
	return value.includes("klausur") || value.includes("abitur");
};

const isClassExam = (examTypeLabel: string) =>
	normalizedExamType(examTypeLabel).includes("klassenarbeit");

export const getDefaultPreparationDepth = (
	examTypeLabel: string,
): PreparationDepth => {
	if (isSmallTest(examTypeLabel)) return "compact";
	if (isMajorWrittenAssessment(examTypeLabel)) return "intensive";
	return "thorough";
};

const basePreparationMinutes = (
	examTypeLabel: string,
	examDurationMinutes: number,
) => {
	const duration = Math.max(15, examDurationMinutes);
	if (isSmallTest(examTypeLabel)) return Math.max(60, duration * 2);
	if (isMajorWrittenAssessment(examTypeLabel)) {
		return Math.max(360, duration * 4);
	}
	if (isClassExam(examTypeLabel)) return Math.max(240, duration * 4);
	return Math.max(180, duration * 3);
};

const depthMultiplier: Record<PreparationDepth, number> = {
	compact: 0.75,
	thorough: 1,
	intensive: 1.25,
};

const clampCount = (value: number) =>
	Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const roundToQuarterHour = (minutes: number) =>
	Math.max(30, Math.round(minutes / 15) * 15);

export const recommendLearningPreparation = ({
	examTypeLabel,
	examDurationMinutes,
	preparationDepth,
	topicReadiness,
	availableMinutes,
}: {
	examTypeLabel: string;
	examDurationMinutes: number;
	preparationDepth: PreparationDepth;
	topicReadiness: TopicReadinessCounts;
	availableMinutes?: number | null;
}): LearningPreparationRecommendation => {
	const unknown = clampCount(topicReadiness.unknown);
	const developing = clampCount(topicReadiness.developing);
	const readinessMinutes = unknown * 30 + developing * 15;
	const recommendedMinutes = Math.min(
		MAX_RECOMMENDED_MINUTES,
		roundToQuarterHour(
			(basePreparationMinutes(examTypeLabel, examDurationMinutes) +
				readinessMinutes) *
				depthMultiplier[preparationDepth],
		),
	);
	const minimumMinutes = roundToQuarterHour(recommendedMinutes * 0.5);
	const usableAvailability =
		availableMinutes !== undefined && availableMinutes !== null
			? Math.floor(availableMinutes / 5) * 5
			: recommendedMinutes;
	const plannedMinutes = Math.min(recommendedMinutes, usableAvailability);
	const praxisSessionCount = isSmallTest(examTypeLabel)
		? 1
		: preparationDepth === "intensive" && unknown >= 5
			? 3
			: 2;

	return {
		recommendedMinutes,
		minimumMinutes,
		plannedMinutes,
		preparationGapMinutes: recommendedMinutes - plannedMinutes,
		praxisSessionCount,
	};
};
