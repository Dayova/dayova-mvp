import type { OnboardingAnswers } from "~/context/OnboardingContext";
import { meetsPasswordRequirements } from "~/lib/password-validation";

type AnswerStepKind = "chips" | "goals" | "range" | "wheel";

export type OnboardingDecisionStep =
	| {
			kind: "text";
			field: "email" | "name" | "password" | "schoolType";
	  }
	| { kind: AnswerStepKind; field: keyof OnboardingAnswers }
	| { kind: "fact" | "infoStack" | "intro" };

export type OnboardingStepDecision = {
	action: "advance" | "register";
	error: string | null;
};

const isValidEmail = (value: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const isValidName = (value: string) =>
	value.trim().length >= 2 && /^[A-Za-zÀ-ÿ' -]+$/.test(value.trim());

export function getOnboardingStepDecision(
	step: OnboardingDecisionStep,
	answers: OnboardingAnswers,
): OnboardingStepDecision {
	if (step.kind === "text") {
		const value = answers[step.field];
		if (step.field === "name" && !isValidName(value)) {
			return { action: "advance", error: "Bitte gib deinen Namen ein." };
		}
		if (step.field === "schoolType" && value.trim().length < 2) {
			return { action: "advance", error: "Bitte gib deine Schulform ein." };
		}
		if (step.field === "email" && !isValidEmail(value)) {
			return {
				action: "advance",
				error: "Bitte gib eine gültige E-Mail-Adresse ein.",
			};
		}
		if (step.field === "password") {
			return meetsPasswordRequirements(value)
				? { action: "register", error: null }
				: {
						action: "register",
						error: "Bitte gib ein Passwort mit mindestens 8 Zeichen ein.",
					};
		}
	}

	if (
		(step.kind === "chips" ||
			step.kind === "goals" ||
			step.kind === "range" ||
			step.kind === "wheel") &&
		!answers[step.field].trim()
	) {
		return { action: "advance", error: "Bitte wähle eine Antwort aus." };
	}

	return { action: "advance", error: null };
}

export function getNextOnboardingStepIndex(
	activeIndex: number,
	stepCount: number,
) {
	if (stepCount <= 0) return 0;
	return Math.min(Math.max(activeIndex + 1, 0), stepCount - 1);
}

export const getOnboardingRegistrationPayload = (
	answers: OnboardingAnswers,
) => ({
	name: answers.name.trim(),
	email: answers.email.trim().toLowerCase(),
	password: answers.password,
	birthDate: answers.birthDate,
	grade: answers.grade,
	schoolType: answers.schoolType,
	state: answers.state,
});
