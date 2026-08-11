export const ONBOARDING_CHALLENGE_OPTIONS = [
	{
		value: "procrastination",
		label: "Ich schiebe den Start auf",
		description: "Der erste Schritt fühlt sich zu groß an.",
	},
	{
		value: "unclear_start",
		label: "Ich weiß nicht, wo ich anfangen soll",
		description: "Stoff und Materialien wirken unübersichtlich.",
	},
	{
		value: "focus",
		label: "Ich verliere schnell den Fokus",
		description: "Beim Lernen lasse ich mich leicht ablenken.",
	},
	{
		value: "exam_anxiety",
		label: "Prüfungen stressen mich",
		description: "Unsicherheit nimmt mir Ruhe und Energie.",
	},
	{
		value: "time_management",
		label: "Mir fehlt ein realistischer Plan",
		description: "Ich unterschätze Zeit oder starte zu spät.",
	},
	{
		value: "knowledge_gaps",
		label: "Ich kenne meine Lücken nicht",
		description: "Ich lerne viel, aber nicht immer das Richtige.",
	},
] as const;

export const ONBOARDING_GOAL_OPTIONS = [
	{
		value: "start_in_time",
		label: "Früher und leichter anfangen",
		description: "Ohne lange Anlaufzeit ins Lernen kommen.",
	},
	{
		value: "pass_confidently",
		label: "Sicher in die Prüfung gehen",
		description: "Wissen, dass ich die wichtigen Themen kann.",
	},
	{
		value: "improve_grades",
		label: "Meine Noten verbessern",
		description: "Gezielter lernen und Fortschritt sehen.",
	},
	{
		value: "reduce_stress",
		label: "Weniger Lernstress haben",
		description: "Mit einem machbaren Weg statt Last-Minute-Pauken.",
	},
	{
		value: "stay_consistent",
		label: "Regelmäßig dranbleiben",
		description: "Kleine Schritte zu einer verlässlichen Routine machen.",
	},
] as const;

export type OnboardingChallenge =
	(typeof ONBOARDING_CHALLENGE_OPTIONS)[number]["value"];
export type OnboardingGoal = (typeof ONBOARDING_GOAL_OPTIONS)[number]["value"];

const challengePayoffs: Record<OnboardingChallenge, string> = {
	procrastination: "mit einem kleinen, klaren Start statt einer großen Hürde",
	unclear_start: "mit einer eindeutigen Reihenfolge statt Stoffchaos",
	focus: "mit kurzen, konkreten Lernschritten statt endlosen Sitzungen",
	exam_anxiety: "mit sichtbarem Fortschritt statt letzter Unsicherheit",
	time_management: "mit einem Plan, der zu deiner echten Zeit passt",
	knowledge_gaps: "mit Fokus auf die Themen, die dir wirklich noch fehlen",
};

const goalOutcomes: Record<OnboardingGoal, string> = {
	start_in_time: "leichter anfangen",
	pass_confidently: "sicherer in deine Prüfung gehen",
	improve_grades: "gezielter auf bessere Ergebnisse hinarbeiten",
	reduce_stress: "mit weniger Druck lernen",
	stay_consistent: "verlässlich dranbleiben",
};

export function getOnboardingOptionLabel(
	options: readonly { value: string; label: string }[],
	value: string,
) {
	return options.find((option) => option.value === value)?.label ?? value;
}

export function getOnboardingPayoff(input: {
	name: string;
	studyTime: string;
	challenge: OnboardingChallenge | "";
	goal: OnboardingGoal | "";
}) {
	const name = input.name.trim().split(/\s+/)[0] || "Du";
	const minutes = Number.parseInt(input.studyTime, 10);
	const time = Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
	const challenge = input.challenge
		? challengePayoffs[input.challenge]
		: "mit einem klaren nächsten Schritt";
	const goal = input.goal ? goalOutcomes[input.goal] : "dein Ziel erreichen";

	return {
		heading: `${name}, daraus wird dein persönlicher Weg.`,
		body: `Dayova plant mit deinen ${time} Minuten ${challenge}, damit du ${goal} kannst.`,
	};
}
