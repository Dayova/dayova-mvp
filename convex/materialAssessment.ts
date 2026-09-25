export type MaterialAssessment = {
	verdict: "sufficient" | "insufficient" | "uncertain";
	missingInformation: string;
};

export type MaterialReadinessDecision =
	| { kind: "ready" }
	| { kind: "insufficientMaterial"; missingInformation: string }
	| { kind: "unknown" }
	| { kind: "generationProcessing" };

export const MIN_MATERIAL_TOPIC_COUNT = 3;
export const MIN_MATERIAL_QUESTION_COUNT = 5;

export const decideMaterialReadiness = (
	assessment: MaterialAssessment,
	output: {
		sourceSummary: string;
		topicCount: number;
		questionCount: number;
	},
): MaterialReadinessDecision => {
	if (assessment.verdict === "uncertain") return { kind: "unknown" };

	if (assessment.verdict === "insufficient") {
		const missingInformation = assessment.missingInformation.trim();
		const contradictsGeneratedContent =
			output.sourceSummary.trim().length >= 20 &&
			output.topicCount >= MIN_MATERIAL_TOPIC_COUNT &&
			output.questionCount >= MIN_MATERIAL_QUESTION_COUNT;
		return missingInformation.length >= 12 && !contradictsGeneratedContent
			? { kind: "insufficientMaterial", missingInformation }
			: { kind: "unknown" };
	}

	return output.sourceSummary.trim().length >= 20 &&
		output.topicCount >= MIN_MATERIAL_TOPIC_COUNT &&
		output.questionCount >= MIN_MATERIAL_QUESTION_COUNT
		? { kind: "ready" }
		: { kind: "generationProcessing" };
};
