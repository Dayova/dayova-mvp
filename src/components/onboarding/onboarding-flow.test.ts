import { describe, expect, test } from "vitest";
import type { OnboardingAnswers } from "~/context/OnboardingContext";
import {
	getNextOnboardingStepIndex,
	getOnboardingRegistrationPayload,
	getOnboardingStepDecision,
} from "./onboarding-flow";

const answers = (
	patch: Partial<OnboardingAnswers> = {},
): OnboardingAnswers => ({
	studyTime: "30 min",
	strength: "Mathe",
	challenge: "Organisation",
	goal: "Mehr Struktur im Lernen",
	state: "Sachsen",
	schoolType: "Gymnasium",
	grade: "9",
	dailySchoolTime: "60 min",
	studyDays: "Montag, Mittwoch",
	learningTime: "16:44",
	name: "Jakob Rössner",
	email: "jakob@example.de",
	birthDate: "09.09.2012",
	password: "supersecret",
	...patch,
});

describe("onboarding flow decisions", () => {
	test("validates learner input before advancing", () => {
		expect(
			getOnboardingStepDecision(
				{ kind: "text", field: "name" },
				answers({ name: "!" }),
			).error,
		).toBe("Bitte gib deinen Namen ein.");
		expect(
			getOnboardingStepDecision(
				{ kind: "text", field: "email" },
				answers({ email: "keine-adresse" }),
			).error,
		).toBe("Bitte gib eine gültige E-Mail-Adresse ein.");
		expect(
			getOnboardingStepDecision(
				{ kind: "wheel", field: "state" },
				answers({ state: "" }),
			).error,
		).toBe("Bitte wähle eine Antwort aus.");
	});

	test("registers only from a valid password step", () => {
		expect(
			getOnboardingStepDecision(
				{ kind: "text", field: "password" },
				answers({ password: "short" }),
			),
		).toEqual({
			action: "register",
			error: "Bitte gib ein Passwort mit mindestens 8 Zeichen ein.",
		});
		expect(
			getOnboardingStepDecision({ kind: "text", field: "password" }, answers()),
		).toEqual({ action: "register", error: null });
	});

	test("clamps progression at the final step", () => {
		expect(getNextOnboardingStepIndex(3, 10)).toBe(4);
		expect(getNextOnboardingStepIndex(9, 10)).toBe(9);
		expect(getNextOnboardingStepIndex(0, 0)).toBe(0);
	});

	test("normalizes the Clerk registration payload", () => {
		expect(
			getOnboardingRegistrationPayload(
				answers({ name: "  Jakob Rössner  ", email: "  JAKOB@EXAMPLE.DE " }),
			),
		).toEqual({
			name: "Jakob Rössner",
			email: "jakob@example.de",
			password: "supersecret",
			birthDate: "09.09.2012",
			grade: "9",
			schoolType: "Gymnasium",
			state: "Sachsen",
		});
	});
});
