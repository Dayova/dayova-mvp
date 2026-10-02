import type { TextInputProps } from "react-native";
import { ONBOARDING_DURATION_OPTIONS } from "~/components/onboarding/onboarding-learning-times";
import type { OnboardingAnswers } from "~/context/OnboardingContext";

type RangeStep = {
	kind: "range";
	id: "studyTime";
	title: string;
	description: string;
	field: "studyTime";
	values: readonly number[];
};

type FactStep = {
	kind: "fact";
	id: "study-time-fact";
	title: string;
	description: string;
};

type DaysStep = {
	kind: "days";
	id: "studyDays";
	title: string;
	description: string;
	field: "studyDays";
};

type ScheduleExplanationStep = {
	kind: "schedule-explanation";
	id: "learning-days-explanation";
	title: string;
	description: string;
};

type TimeStep = {
	kind: "time";
	id: "learningTime";
	title: string;
	description: string;
	field: "learningTime";
};

type PayoffStep = {
	kind: "payoff";
	id: "learning-time-payoff";
	title: string;
	description: string;
};

type TextStep = {
	kind: "text";
	id: "name" | "email" | "password";
	title: string;
	description: string;
	field: "name" | "email" | "password";
	placeholder: string;
	secure?: boolean;
	keyboardType?: TextInputProps["keyboardType"];
	autoComplete?: TextInputProps["autoComplete"];
	textContentType?: TextInputProps["textContentType"];
};

type WheelStep = {
	kind: "wheel";
	id: "state" | "schoolType" | "grade";
	title: string;
	description: string;
	field: Extract<keyof OnboardingAnswers, "state" | "schoolType" | "grade">;
};

export type OnboardingProfileStep =
	| RangeStep
	| FactStep
	| DaysStep
	| ScheduleExplanationStep
	| TimeStep
	| PayoffStep
	| TextStep
	| WheelStep;

export type OnboardingStepId = OnboardingProfileStep["id"];

export const ONBOARDING_PROFILE_STEPS = [
	{
		kind: "text",
		id: "name",
		title: "Wie dürfen wir dich nennen?",
		description: "Damit sich Dayova von Anfang an persönlich anfühlt.",
		field: "name",
		placeholder: "Dein Name",
		autoComplete: "name",
		textContentType: "name",
	},
	{
		kind: "range",
		id: "studyTime",
		title: "Wie lange möchtest du pro Tag lernen?",
		description:
			"Wähle die Zeit, die du dir an deinen Lerntagen nehmen möchtest. Damit legt Dayova die Dauer deiner Lernzeiten fest.",
		field: "studyTime",
		values: ONBOARDING_DURATION_OPTIONS,
	},
	{
		kind: "fact",
		id: "study-time-fact",
		title: "Deine Lernzeit. Dein Anfang.",
		description: "Du gibst dem Lernen einen festen Platz in deinem Alltag.",
	},
	{
		kind: "days",
		id: "studyDays",
		title: "An welchen Tagen kannst du regelmäßig lernen?",
		description:
			"Wähle die Wochentage, an denen du dir regelmäßig Zeit nehmen kannst. Dayova legt dort deine wöchentlichen Lernzeiten an.",
		field: "studyDays",
	},
	{
		kind: "schedule-explanation",
		id: "learning-days-explanation",
		title: "Damit Lernen in deinen Alltag passt.",
		description:
			"Deine Lerntage zeigen Dayova, wann du Zeit hast. Zusammen mit deiner gewählten Dauer bilden sie die Grundlage für deine Lernplanung.",
	},
	{
		kind: "time",
		id: "learningTime",
		title: "Zu welcher Uhrzeit lernst du am besten?",
		description:
			"Wähle die Uhrzeit, zu der du an deinen Lerntagen starten möchtest.",
		field: "learningTime",
	},
	{
		kind: "payoff",
		id: "learning-time-payoff",
		title: "Das sind deine Lernzeiten.",
		description:
			"Diese Zeiten sind die Grundlage für deine Lernplanung. Du kannst sie später in den Einstellungen ändern.",
	},
	{
		kind: "wheel",
		id: "grade",
		title: "Welche Klassenstufe besuchst du?",
		description: "Diese Angabe wird in deinem Schulprofil gespeichert.",
		field: "grade",
	},
	{
		kind: "wheel",
		id: "state",
		title: "In welchem Bundesland gehst du zur Schule?",
		description: "Diese Angabe wird in deinem Schulprofil gespeichert.",
		field: "state",
	},
	{
		kind: "wheel",
		id: "schoolType",
		title: "Welche Schulart besuchst du?",
		description:
			"Wir speichern nur die Schulart, nicht den Namen deiner Schule.",
		field: "schoolType",
	},
	{
		kind: "text",
		id: "email",
		title: "Wie lautet deine E-Mail-Adresse?",
		description:
			"Dorthin senden wir gleich deinen sechsstelligen Bestätigungscode.",
		field: "email",
		placeholder: "name@beispiel.de",
		keyboardType: "email-address",
		autoComplete: "email",
		textContentType: "emailAddress",
	},
	{
		kind: "text",
		id: "password",
		title: "Lege dein Passwort fest.",
		description: "Mindestens 8 Zeichen schützen dein Konto.",
		field: "password",
		placeholder: "Passwort eingeben",
		secure: true,
		autoComplete: "new-password",
		textContentType: "newPassword",
	},
] as const satisfies readonly OnboardingProfileStep[];

const stepById = new Map(
	ONBOARDING_PROFILE_STEPS.map((step) => [step.id, step] as const),
);

export const isOnboardingStepId = (value: string): value is OnboardingStepId =>
	stepById.has(value as OnboardingStepId);

export const getOnboardingStep = (stepId: OnboardingStepId) =>
	stepById.get(stepId) as OnboardingProfileStep;

export const getNextOnboardingStep = (stepId: OnboardingStepId) => {
	const index = ONBOARDING_PROFILE_STEPS.findIndex(
		(step) => step.id === stepId,
	);
	return ONBOARDING_PROFILE_STEPS[index + 1] ?? null;
};

export const getOnboardingStepPath = (stepId: OnboardingStepId) =>
	`/onboarding/${stepId}` as const;

export const getOnboardingStepProgress = (stepId: OnboardingStepId) => {
	const stepNumber =
		ONBOARDING_PROFILE_STEPS.findIndex((step) => step.id === stepId) + 1;
	return {
		progress: stepNumber / ONBOARDING_PROFILE_STEPS.length,
		stepCount: ONBOARDING_PROFILE_STEPS.length,
		stepNumber,
	};
};

export const resolveOnboardingStepEntry = ({
	requestedStep,
	visitedSteps,
}: {
	requestedStep: string;
	visitedSteps: ReadonlySet<string>;
}) => {
	if (!isOnboardingStepId(requestedStep) || !visitedSteps.has(requestedStep)) {
		return { kind: "fallback" as const, path: "/" as const };
	}
	return { kind: "step" as const, stepId: requestedStep };
};
