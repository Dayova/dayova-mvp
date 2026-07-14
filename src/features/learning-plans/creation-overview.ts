type LearningPlanStatus = "draft" | "questionsReady" | "generated" | "accepted";

type LearningPlanOverviewInput = {
	status: LearningPlanStatus;
	questionCount?: number;
	answeredQuestionCount?: number;
	firstUnansweredQuestionIndex?: number | null;
};

type LearningPlanOverviewState =
	| {
			kind: "creation";
			badgeLabel: "Noch nicht erstellt";
			actionLabel: "Lernplan-Erstellung fortsetzen";
			progressLabel: string;
			resumeTarget:
				| { kind: "question"; questionIndex: number }
				| { kind: "generation" };
	  }
	| { kind: "created" };

export const getLearningPlanOverviewState = (
	overview: LearningPlanOverviewInput,
): LearningPlanOverviewState => {
	if (overview.status !== "questionsReady") return { kind: "created" };

	const questionCount = overview.questionCount ?? 0;
	const answeredQuestionCount = overview.answeredQuestionCount ?? 0;
	const firstUnansweredQuestionIndex = overview.firstUnansweredQuestionIndex;

	return {
		kind: "creation",
		badgeLabel: "Noch nicht erstellt",
		actionLabel: "Lernplan-Erstellung fortsetzen",
		progressLabel: `${answeredQuestionCount} von ${questionCount} Fragen beantwortet`,
		resumeTarget:
			firstUnansweredQuestionIndex === null
				? { kind: "generation" }
				: {
						kind: "question",
						questionIndex: Math.max(firstUnansweredQuestionIndex ?? 0, 0),
					},
	};
};

export type { LearningPlanOverviewInput, LearningPlanOverviewState };
