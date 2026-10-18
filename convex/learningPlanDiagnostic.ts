import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const MIN_DIAGNOSTIC_QUESTION_COUNT = 5;
const MAX_DIAGNOSTIC_QUESTION_COUNT = 10;

export type StoredKnowledgeQuestion = NonNullable<
	Doc<"learningPlans">["knowledgeQuestions"]
>[number];

export const validateFirstSessionDiagnosticQuestions = (
	questions: StoredKnowledgeQuestion[],
	topics: Doc<"learningPlans">["topicMap"],
) => {
	if (
		questions.length < MIN_DIAGNOSTIC_QUESTION_COUNT ||
		questions.length > MAX_DIAGNOSTIC_QUESTION_COUNT
	) {
		throwUserFacingError(
			`Der Wissenscheck braucht ${MIN_DIAGNOSTIC_QUESTION_COUNT} bis ${MAX_DIAGNOSTIC_QUESTION_COUNT} Fragen.`,
		);
	}

	const topicIds = new Set((topics ?? []).map((topic) => topic.id));
	const questionIds = new Set<string>();
	for (const question of questions) {
		if (!question.id.trim() || questionIds.has(question.id)) {
			throwUserFacingError(
				"Die Fragen des Wissenschecks brauchen eindeutige Kennungen.",
			);
		}
		questionIds.add(question.id);
		if (
			question.kind !== "performance" ||
			!question.topicId ||
			!topicIds.has(question.topicId) ||
			!question.evidenceDimension ||
			!question.idealAnswer?.trim() ||
			!question.explanation?.trim() ||
			!question.responseKind
		) {
			throwUserFacingError(
				"Jede Frage des Wissenschecks muss Wissen prüfen und einem Prüfungsthema zugeordnet sein.",
			);
		}

		if (question.responseKind === "multipleChoice") {
			const options = question.options ?? [];
			const uniqueOptions = new Set(options.map((option) => option.trim()));
			if (
				options.length < 2 ||
				uniqueOptions.size !== options.length ||
				!question.correctAnswer ||
				!options.includes(question.correctAnswer)
			) {
				throwUserFacingError(
					"Multiple-Choice-Fragen im Wissenscheck brauchen eindeutige Optionen und eine richtige Antwort.",
				);
			}
		}
	}
};

export const insertFirstSessionDiagnosticItems = async (
	ctx: MutationCtx,
	args: {
		plan: Doc<"learningPlans">;
		sessionId: Id<"learningPlanSessions">;
		questions: StoredKnowledgeQuestion[];
		now: number;
	},
) => {
	for (const [questionIndex, question] of args.questions.entries()) {
		const choices =
			question.responseKind === "multipleChoice"
				? (question.options ?? []).map((option, optionIndex) => ({
						id: `diagnostic-${questionIndex + 1}-choice-${optionIndex + 1}`,
						text: option,
					}))
				: undefined;
		const correctChoiceId = choices?.find(
			(choice) => choice.text === question.correctAnswer,
		)?.id;

		await ctx.db.insert("learningSessionContentItems", {
			ownerTokenIdentifier: args.plan.ownerTokenIdentifier,
			learningPlanId: args.plan._id,
			sessionId: args.sessionId,
			phase: "practice",
			kind:
				question.responseKind === "multipleChoice"
					? "multipleChoice"
					: "written",
			title: `Frage ${questionIndex + 1}`,
			prompt: question.prompt,
			explanation: question.explanation ?? question.targetInsight,
			idealAnswer: question.idealAnswer ?? question.correctAnswer ?? "",
			choices,
			correctChoiceId,
			evaluationKeywords: (question.evaluationKeywords ?? []).map((keyword) =>
				keyword.toLowerCase(),
			),
			learningBlockIndex: 0,
			topicId: question.topicId,
			evidenceDimension: question.evidenceDimension,
			questionAngle: "diagnostic",
			coverageKey: `diagnostic:${question.id}`,
			estimatedSeconds: 60,
			sortOrder: questionIndex,
			createdAt: args.now,
			updatedAt: args.now,
		});
	}
};
