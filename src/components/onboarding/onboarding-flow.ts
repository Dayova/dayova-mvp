import type { OnboardingAnswers } from "~/context/OnboardingContext";
import { meetsPasswordRequirements } from "~/lib/password-validation";
import { formatOnboardingBirthDate } from "./birth-date";
import { getOnboardingLearningTimeValidationError } from "./onboarding-learning-times";

type AnswerStepKind = "days" | "range" | "time" | "wheel";

export type OnboardingDecisionStep =
	| {
			kind: "text";
			field: "email" | "name" | "password";
	  }
	| { kind: AnswerStepKind; field: keyof OnboardingAnswers }
	| { kind: "fact" | "intro" | "payoff" };

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
		(step.kind === "days" ||
			step.kind === "range" ||
			step.kind === "time" ||
			step.kind === "wheel") &&
		!answers[step.field].trim()
	) {
		return {
			action: "advance",
			error:
				step.kind === "days"
					? "Bitte wähle mindestens einen Lerntag aus."
					: step.kind === "time"
						? "Bitte wähle eine Uhrzeit aus."
						: "Bitte wähle eine Antwort aus.",
		};
	}

	if (step.kind === "time") {
		return {
			action: "advance",
			error: getOnboardingLearningTimeValidationError(answers),
		};
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
	birthDate: formatOnboardingBirthDate({
		year: answers.birthYear,
		month: answers.birthMonth,
		day: answers.birthDay,
	}),
	grade: answers.grade,
	schoolType: answers.schoolType || undefined,
	state: answers.state,
});

export const getOnboardingPersistenceAnswers = (
	answers: OnboardingAnswers,
) => ({
	dailySchoolTime: `${Number.parseInt(answers.studyTime, 10)} min`,
	studyDays: answers.studyDays,
	learningTime: answers.learningTime,
	state: answers.state,
	schoolType: answers.schoolType,
	grade: answers.grade,
});
