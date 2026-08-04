export type DashboardKnowledgeProgressInput = {
	hasKnowledgeEvidence: boolean;
	hasLearningPlan: boolean;
	isLoading: boolean;
	secureTopics: number;
	totalTopics: number;
};

export type DashboardKnowledgeProgressViewModel = {
	accessibilityLabel: string;
	footer: string;
	progressPercent: number;
	ringLabel: string;
	ringValue: string;
};

export const getDashboardKnowledgeProgressViewModel = ({
	hasKnowledgeEvidence,
	hasLearningPlan,
	isLoading,
	secureTopics,
	totalTopics,
}: DashboardKnowledgeProgressInput): DashboardKnowledgeProgressViewModel => {
	if (isLoading) {
		return {
			accessibilityLabel: "Wissensstand wird geladen",
			footer: "Wissensstand",
			progressPercent: 0,
			ringLabel: "wird geladen",
			ringValue: "–",
		};
	}

	if (!hasLearningPlan || totalTopics <= 0) {
		return {
			accessibilityLabel: "Wissensstand: Noch kein persönlicher Lernplan",
			footer: "Lernplan öffnen",
			progressPercent: 0,
			ringLabel: "Themen",
			ringValue: "–",
		};
	}

	if (!hasKnowledgeEvidence) {
		return {
			accessibilityLabel: "Wissensstand: Noch keine Wissensbelege",
			footer: "Noch keine Belege",
			progressPercent: 0,
			ringLabel: "Themen",
			ringValue: "–",
		};
	}

	const safeTotal = Math.max(0, totalTopics);
	const safeSecure = Math.min(Math.max(0, secureTopics), safeTotal);
	const topicLabel = safeTotal === 1 ? "Thema sicher" : "Themen sicher";
	const allTopicsSecure = safeSecure === safeTotal;
	const footer = allTopicsSecure ? "Alle Themen sicher" : "Details ansehen";

	return {
		accessibilityLabel: `Wissensstand: ${safeSecure} von ${safeTotal} ${topicLabel}. ${footer}.`,
		footer,
		progressPercent: Math.round((safeSecure / safeTotal) * 100),
		ringLabel: topicLabel,
		ringValue: `${safeSecure} / ${safeTotal}`,
	};
};
