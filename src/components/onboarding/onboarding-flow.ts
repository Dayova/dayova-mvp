export type OnboardingAnswers = {
	studyTime: string;
	strength: string;
	challenge: string;
	goal: string;
	state: string;
	name: string;
	email: string;
	birthDate: string;
	password: string;
};

export type OnboardingAnswerField = keyof OnboardingAnswers;

export type IntroStep = {
	description: string;
	illustration: "plan" | "focus" | "success";
	kind: "intro";
	title: string;
};

export type SelectStep = {
	field: "studyTime" | "strength" | "challenge" | "goal";
	kind: "select";
	options: readonly string[];
	title: string;
};

export type InputStep = {
	field: "state";
	kind: "input";
	label: string;
	placeholder: string;
	title: string;
};

export type ProfileStep = {
	field: "birthDate" | "email" | "name";
	kind: "profile";
	label: string;
	placeholder?: string;
	title: string;
};

export type PasswordStep = {
	kind: "password";
	title: string;
};

export type OnboardingStep =
	| InputStep
	| IntroStep
	| PasswordStep
	| ProfileStep
	| SelectStep;

export type StepErrors = Partial<
	Record<"birthDate" | "email" | "name" | "password", string>
>;

export const EMPTY_ONBOARDING_ANSWERS: OnboardingAnswers = {
	studyTime: "",
	strength: "",
	challenge: "",
	goal: "",
	state: "",
	name: "",
	email: "",
	birthDate: "",
	password: "",
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
	{
		kind: "intro",
		illustration: "plan",
		title: "Schluss mit Aufschieben. Dein Lernplan wartet.",
		description:
			"Dayova sortiert Aufgaben, Lernzeiten und Erinnerungen so, dass du leichter loslegst.",
	},
	{
		kind: "intro",
		illustration: "focus",
		title: "Du lernst fokussiert. Wir halten den Plan zusammen.",
		description:
			"Kleine Schritte, klare Reihenfolge und ein Überblick, der nicht stresst.",
	},
	{
		kind: "intro",
		illustration: "success",
		title: "Bleib dran und sieh deinen Fortschritt wachsen.",
		description:
			"Aus deinen Antworten entsteht ein Setup, das zu deinem Schulalltag passt.",
	},
	{
		kind: "select",
		title: "Wie viel lernst du aktuell pro Tag?",
		field: "studyTime",
		options: [
			"Unter 30 Min.",
			"30 bis 60 Min.",
			"1 bis 2 Stunden",
			"Mehr als 2 Stunden",
		],
	},
	{
		kind: "select",
		title: "Wo liegen deine Stärken?",
		field: "strength",
		options: [
			"Sprachen",
			"Mathematik",
			"Naturwissenschaften",
			"Kreative Fächer",
		],
	},
	{
		kind: "select",
		title: "Was sind deine größten Baustellen in der Schule?",
		field: "challenge",
		options: ["Konzentration", "Motivation", "Organisation", "Prüfungsstress"],
	},
	{
		kind: "select",
		title: "Was möchtest du mit uns erreichen?",
		field: "goal",
		options: [
			"Bessere Noten",
			"Mehr Struktur",
			"Weniger Stress",
			"Konstant dranbleiben",
		],
	},
	{
		kind: "input",
		title: "Aus welchem Bundesland kommst du?",
		field: "state",
		label: "Bundesland",
		placeholder: "z. B. Bayern",
	},
	{
		kind: "profile",
		title: "Wie heißt du?",
		field: "name",
		label: "Name",
		placeholder: "Max Mustermann",
	},
	{
		kind: "profile",
		title: "Wie lautet deine E-Mail?",
		field: "email",
		label: "E-Mail",
		placeholder: "name@example.com",
	},
	{
		kind: "profile",
		title: "Wie alt bist du?",
		field: "birthDate",
		label: "Alter",
	},
	{
		kind: "password",
		title: "Lege dein Passwort fest",
	},
] as const;

export const FIRST_ONBOARDING_STEP = ONBOARDING_STEPS[0] as OnboardingStep;

export const INTRO_STEP_COUNT = ONBOARDING_STEPS.filter(
	(step) => step.kind === "intro",
).length;

export const formatBirthDate = (date: Date) => {
	const day = `${date.getDate()}`.padStart(2, "0");
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	return `${day}.${month}.${date.getFullYear()}`;
};

export const parseBirthDate = (value: string) => {
	const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
	if (!match) return null;
	const parsed = new Date(
		Number(match[3]),
		Number(match[2]) - 1,
		Number(match[1]),
	);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getAgeFromBirthDate = (date: Date, today = new Date()) => {
	let age = today.getFullYear() - date.getFullYear();
	const hadBirthdayThisYear =
		today.getMonth() > date.getMonth() ||
		(today.getMonth() === date.getMonth() && today.getDate() >= date.getDate());
	if (!hadBirthdayThisYear) age -= 1;
	return Math.max(age, 0);
};

export const isValidBirthDate = (date: Date | null, today = new Date()) =>
	Boolean(date && date <= today && getAgeFromBirthDate(date, today) >= 6);

export const isValidEmail = (value: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

export const isValidName = (value: string) =>
	value.trim().length >= 2 && /^[A-Za-zÀ-ÿ' -]+$/.test(value.trim());

export const isValidPassword = (value: string) => value.trim().length >= 8;

export const isStepComplete = (
	step: OnboardingStep,
	answers: OnboardingAnswers,
) => {
	if (step.kind === "intro") return true;
	if (step.kind === "select" || step.kind === "input") {
		return answers[step.field].trim().length > 0;
	}
	if (step.kind === "profile") {
		return answers[step.field].trim().length > 0;
	}
	return answers.password.trim().length > 0;
};

export const validateStep = (
	step: OnboardingStep,
	answers: OnboardingAnswers,
	today = new Date(),
): StepErrors => {
	if (
		step.kind === "profile" &&
		step.field === "name" &&
		!isValidName(answers.name)
	) {
		return { name: "Bitte einen gültigen Namen eingeben." };
	}
	if (
		step.kind === "profile" &&
		step.field === "email" &&
		!isValidEmail(answers.email)
	) {
		return { email: "Bitte eine gültige E-Mail eingeben." };
	}
	if (
		step.kind === "profile" &&
		step.field === "birthDate" &&
		!isValidBirthDate(parseBirthDate(answers.birthDate), today)
	) {
		return { birthDate: "Bitte ein gültiges Alter auswählen." };
	}
	if (step.kind === "password" && !isValidPassword(answers.password)) {
		return {
			password: "Bitte ein Passwort mit mindestens 8 Zeichen eingeben.",
		};
	}
	return {};
};

export const hasStepErrors = (errors: StepErrors) =>
	Object.values(errors).some(Boolean);

export const getRegistrationPayload = (answers: OnboardingAnswers) => ({
	name: answers.name.trim(),
	email: answers.email.trim().toLowerCase(),
	birthDate: answers.birthDate,
	password: answers.password,
});

export const getPersistableOnboardingAnswers = (
	answers: OnboardingAnswers,
) => ({
	studyTime: answers.studyTime,
	strength: answers.strength,
	challenge: answers.challenge,
	goal: answers.goal,
	state: answers.state,
});
