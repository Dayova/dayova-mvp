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
/** Version 1 product defaults, not a diagnostic measurement or grade guarantee. */
export function preparationBudget(examTypeLabel: string) {
	const label = examTypeLabel.trim().toLocaleLowerCase("de-DE");
	// Order matters: oral Abitur still has the Abitur preparation budget.
	if (label.includes("vorabitur")) return { minutes: 720, horizonDays: 42 };
	if (label.includes("abitur")) return { minutes: 1800, horizonDays: 112 };
	if (["test", "kurzkontrolle", "leistungskontrolle", "quiz"].includes(label))
		return { minutes: 60, horizonDays: 7 };
	if (label.includes("klassenarbeit")) return { minutes: 180, horizonDays: 14 };
	if (label.includes("klausur")) return { minutes: 240, horizonDays: 21 };
	if (label.includes("präsentation")) return { minutes: 240, horizonDays: 21 };
	return { minutes: 120, horizonDays: 14 };
}
export function getDefaultPreparationDepth(label: string): PreparationDepth {
	const { minutes } = preparationBudget(label);
	return minutes <= 60
		? "compact"
		: minutes >= 240 && !label.toLowerCase().includes("präsentation")
			? "intensive"
			: "thorough";
}
export function recommendLearningPreparation(args: {
	examTypeLabel: string;
	examDurationMinutes: number;
	preparationDepth: PreparationDepth;
	topicReadiness: TopicReadinessCounts;
	availableMinutes?: number | null;
}): LearningPreparationRecommendation {
	const recommendedMinutes = preparationBudget(args.examTypeLabel).minutes;
	const plannedMinutes =
		args.availableMinutes == null
			? recommendedMinutes
			: Math.min(
					recommendedMinutes,
					Math.max(0, Math.floor(args.availableMinutes / 5) * 5),
				);
	return {
		recommendedMinutes,
		minimumMinutes: 10,
		plannedMinutes,
		preparationGapMinutes: recommendedMinutes - plannedMinutes,
		praxisSessionCount: recommendedMinutes <= 60 ? 1 : 2,
	};
}
