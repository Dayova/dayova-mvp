type LearningPlanStatus = "draft" | "questionsReady" | "generated" | "accepted";

type LearningPlanCreationOverviewInput = {
	status: LearningPlanStatus;
	needsSchoolMaterial: boolean;
	scopeConfirmedAt?: number;
};

type LearningPlanCreationOverview = {
	badgeLabel: "Noch nicht erstellt";
	actionLabel: "Lernplan-Erstellung fortsetzen";
	progressLabel: string;
};

export const getLearningPlanCreationOverview = (
	plan: LearningPlanCreationOverviewInput,
): LearningPlanCreationOverview | null => {
	if (plan.status === "accepted") return null;

	let progressLabel = "Prüfungsthemen gespeichert";
	if (plan.needsSchoolMaterial) {
		progressLabel = "Schulmaterial fehlt";
	} else if (plan.status === "draft") {
		progressLabel = "Schulmaterial gespeichert";
	} else if (plan.status === "questionsReady" && !plan.scopeConfirmedAt) {
		progressLabel = "Prüfungsstoff bestätigen";
	} else if (plan.status === "questionsReady") {
		progressLabel = "Lernweg wird vorbereitet";
	} else if (plan.status === "generated") {
		progressLabel = "Lernweg prüfen";
	}

	return {
		badgeLabel: "Noch nicht erstellt",
		actionLabel: "Lernplan-Erstellung fortsetzen",
		progressLabel,
	};
};
