export type TopicReadinessStatus = "secure" | "developing" | "unknown";

export type TopicReadinessRecord = {
	topicId: string;
	status: TopicReadinessStatus;
};

const normalized = (value: string) =>
	value
		.trim()
		.toLocaleLowerCase("de-DE")
		.replace(/[^a-z0-9äöüß]+/g, " ")
		.replace(/\s+/g, " ");

const isUncertain = (value: string) => {
	const answer = normalized(value);
	return (
		answer.length <= 4 ||
		answer.includes("weiß ich nicht") ||
		answer.includes("weiss ich nicht") ||
		answer.includes("keine ahnung") ||
		answer.includes("unsicher")
	);
};

export const deriveTopicReadiness = ({
	topicIds,
	questions,
	answers,
}: {
	topicIds: string[];
	questions: Array<{
		id: string;
		topicId?: string;
		kind?: "performance" | "confidence";
		evaluationKeywords?: string[];
	}>;
	answers: Array<{ questionId: string; answer: string }>;
}): TopicReadinessRecord[] => {
	const answersByQuestion = new Map(
		answers.map((answer) => [answer.questionId, answer.answer]),
	);

	return topicIds.map((topicId) => {
		const performanceEvidence = questions
			.filter((question) => question.topicId === topicId)
			.filter((question) => question.kind !== "confidence")
			.map((question): TopicReadinessStatus => {
				const answer = answersByQuestion.get(question.id) ?? "";
				if (isUncertain(answer)) return "unknown";
				const answerText = normalized(answer);
				const keywords = (question.evaluationKeywords ?? [])
					.map(normalized)
					.filter(Boolean);
				const matches = keywords.filter((keyword) =>
					answerText.includes(keyword),
				).length;
				if (matches >= Math.min(2, keywords.length) && keywords.length > 0) {
					return "secure";
				}
				return matches > 0 ? "developing" : "unknown";
			});
		const confidenceEvidence = questions
			.filter(
				(question) =>
					question.topicId === topicId && question.kind === "confidence",
			)
			.map((question) => answersByQuestion.get(question.id) ?? "")
			.filter((answer) => !isUncertain(answer));
		const allPerformanceEvidenceSecure =
			performanceEvidence.length > 0 &&
			performanceEvidence.every((status) => status === "secure");
		const hasPartialEvidence =
			performanceEvidence.some(
				(status) => status === "secure" || status === "developing",
			) || confidenceEvidence.length > 0;

		return {
			topicId,
			status: allPerformanceEvidenceSecure
				? "secure"
				: hasPartialEvidence
					? "developing"
					: "unknown",
		};
	});
};
