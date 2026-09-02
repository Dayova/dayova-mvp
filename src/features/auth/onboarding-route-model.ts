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
	id:
		| "state"
		| "schoolType"
		| "grade"
		| "birthYear"
		| "birthMonth"
		| "birthDay";
	title: string;
	description: string;
	field: Extract<
		keyof OnboardingAnswers,
		"state" | "schoolType" | "grade" | "birthYear" | "birthMonth" | "birthDay"
	>;
};

export type OnboardingProfileStep =
	| RangeStep
	| FactStep
	| DaysStep
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
		title: "Wie lange möchtest du pro Lerntag einplanen?",
		description:
			"Damit legst du die Dauer deiner ersten Lernzeiten fest. Du kannst sie später ändern.",
		field: "studyTime",
		values: ONBOARDING_DURATION_OPTIONS,
	},
	{
		kind: "fact",
		id: "study-time-fact",
		title: "Dein Lernplan braucht echte Zeitfenster.",
		description: "Dauer, Tage und Uhrzeit werden im Lernplan gespeichert.",
	},
	{
		kind: "days",
		id: "studyDays",
		title: "An welchen Tagen kannst du lernen?",
		description:
			"Wähle alle passenden Tage. Für jeden entsteht dieselbe erste Lernzeit.",
		field: "studyDays",
	},
	{
		kind: "time",
		id: "learningTime",
		title: "Um wie viel Uhr möchtest du starten?",
		description: "Diese Startzeit gilt für alle ausgewählten Lerntage.",
		field: "learningTime",
	},
	{
		kind: "payoff",
		id: "learning-time-payoff",
		title: "Deine Lernzeiten",
		description: "Prüfe dein wiederkehrendes Zeitfenster.",
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
		kind: "wheel",
		id: "birthYear",
		title: "In welchem Jahr bist du geboren?",
		description:
			"Wir fragen Jahr, Monat und Tag nacheinander – ohne Vorauswahl.",
		field: "birthYear",
	},
	{
		kind: "wheel",
		id: "birthMonth",
		title: "In welchem Monat bist du geboren?",
		description: "Damit dein Geburtsdatum eindeutig und korrekt bleibt.",
		field: "birthMonth",
	},
	{
		kind: "wheel",
		id: "birthDay",
		title: "An welchem Tag bist du geboren?",
		description: "Der letzte Teil deines Geburtsdatums.",
		field: "birthDay",
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
