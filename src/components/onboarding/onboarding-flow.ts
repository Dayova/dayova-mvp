import type { OnboardingAnswers } from "~/context/OnboardingContext";
import { meetsPasswordRequirements } from "~/lib/password-validation";
import {
	getOnboardingLearningTimeValidationError,
	parseOnboardingDurationMinutes,
} from "./onboarding-learning-times";

type AnswerStepKind = "days" | "time" | "wheel";

export type OnboardingDecisionStep =
	| {
			kind: "text";
			field: "email" | "name" | "password";
	  }
	| {
			kind: "range";
			field: keyof OnboardingAnswers;
			values: readonly number[];
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
	value.trim().length >= 2 &&
	/^(?=.*\p{L})[\p{L}\p{M}' -]+$/u.test(value.trim());

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
	if (
		step.kind === "range" &&
		!step.values.includes(Number(answers[step.field]))
	) {
		return { action: "advance", error: "Bitte wähle eine Antwort aus." };
	}

	if (step.kind === "time") {
		return {
			action: "advance",
			error: getOnboardingLearningTimeValidationError(answers),
		};
	}

	return { action: "advance", error: null };
}

export function isOnboardingStepReady(
	step: OnboardingDecisionStep,
	answers: OnboardingAnswers,
) {
	return getOnboardingStepDecision(step, answers).error === null;
}

export const getOnboardingRegistrationPayload = (
	answers: OnboardingAnswers,
) => ({
	name: answers.name.trim(),
	email: answers.email.trim().toLowerCase(),
	password: answers.password,
	grade: answers.grade,
	schoolType: answers.schoolType || undefined,
	state: answers.state,
});

export const getOnboardingPersistenceAnswers = (answers: OnboardingAnswers) => {
	const durationMinutes = parseOnboardingDurationMinutes(answers.studyTime);
	if (durationMinutes === null) {
		throw new Error("Bitte wähle deine Lerndauer aus.");
	}

	return {
		dailySchoolTime: `${durationMinutes} min`,
		studyDays: answers.studyDays,
		learningTime: answers.learningTime,
		state: answers.state,
		schoolType: answers.schoolType,
		grade: answers.grade,
	};
};
