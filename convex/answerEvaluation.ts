export type AnswerRating = "notCorrect" | "partiallyCorrect" | "correct";

export type AnswerEvaluation = {
	rating: AnswerRating;
	review: string;
};

const normalized = (value: string) =>
	value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

export const isUnknownWrittenAnswer = (answer: string) => {
	const value = normalized(answer);
	return (
		value.length === 0 ||
		value === "weiß ich nicht" ||
		value === "weiss ich nicht" ||
		value === "keine ahnung"
	);
};

export const evaluateMultipleChoiceAnswer = ({
	selectedChoiceId,
	correctChoiceId,
	explanation,
}: {
	selectedChoiceId: string;
	correctChoiceId?: string;
	explanation: string;
}): AnswerEvaluation => {
	const isCorrect = selectedChoiceId === correctChoiceId;
	return {
		rating: isCorrect ? "correct" : "notCorrect",
		review: isCorrect
			? `Deine Auswahl ist richtig. ${explanation}`
			: selectedChoiceId === "unknown"
				? `Du hast noch keine Antwort ausgewählt. ${explanation}`
				: `Deine Auswahl ist nicht richtig. ${explanation}`,
	};
};
