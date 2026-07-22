type LearningPlanStatus = "draft" | "questionsReady" | "generated" | "accepted";

type LearningPlanOverviewInput = {
	status: LearningPlanStatus;
	creationProgress?: {
		questionCount: number;
		answeredQuestionCount: number;
		firstUnansweredQuestionIndex: number | null;
	} | null;
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

	let progressLabel: string;
	let resumeTarget:
		| { kind: "question"; questionIndex: number }
		| { kind: "generation" };

	if (!overview.creationProgress) {
		progressLabel = "Fortschritt wird geladen";
		resumeTarget = { kind: "question", questionIndex: 0 };
	} else {
		const {
			questionCount,
			answeredQuestionCount,
			firstUnansweredQuestionIndex,
		} = overview.creationProgress;
		progressLabel = `${answeredQuestionCount} von ${questionCount} Fragen beantwortet`;
		resumeTarget =
			firstUnansweredQuestionIndex === null
				? { kind: "generation" }
				: {
						kind: "question",
						questionIndex: Math.max(firstUnansweredQuestionIndex, 0),
					};
	}

	return {
		kind: "creation",
		badgeLabel: "Noch nicht erstellt",
		actionLabel: "Lernplan-Erstellung fortsetzen",
		progressLabel,
		resumeTarget,
	};
};

export type { LearningPlanOverviewInput, LearningPlanOverviewState };
