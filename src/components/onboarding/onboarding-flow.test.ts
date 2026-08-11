import { describe, expect, test } from "vitest";
import type { OnboardingAnswers } from "~/context/OnboardingContext";
import {
	type ClerkRegistrationInput,
	prepareClerkRegistration,
} from "~/lib/clerk-registration";
import {
	getNextOnboardingStepIndex,
	getOnboardingRegistrationPayload,
	getOnboardingStepDecision,
} from "./onboarding-flow";

const answers = (
	patch: Partial<OnboardingAnswers> = {},
): OnboardingAnswers => ({
	studyTime: "30 min",
	challenge: "time_management",
	goal: "stay_consistent",
	state: "Sachsen",
	schoolType: "gymnasium",
	grade: "9",
	name: "Jakob Rössner",
	email: "jakob@example.de",
	birthYear: "2012",
	birthMonth: "09",
	birthDay: "09",
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

	test("preserves grade 13 from onboarding through the Clerk registration boundary", () => {
		const registrationPayload = getOnboardingRegistrationPayload(
			answers({
				name: "  Jakob Rössner  ",
				email: "  JAKOB@EXAMPLE.DE ",
				grade: "13",
			}),
		);

		expect(registrationPayload).toEqual({
			name: "Jakob Rössner",
			email: "jakob@example.de",
			password: "supersecret",
			birthDate: "09.09.2012",
			grade: "13",
			schoolType: "gymnasium",
			state: "Sachsen",
		});

		expect(prepareClerkRegistration(registrationPayload)).toMatchObject({
			profile: { grade: "13" },
			signUp: {
				unsafeMetadata: { grade: "13" },
			},
		});
	});

	test("keeps the bounded school type through the Clerk registration boundary", () => {
		const registrationPayload = getOnboardingRegistrationPayload(
			answers({ schoolType: "prefer_not_to_say" }),
		);

		expect(prepareClerkRegistration(registrationPayload)).toMatchObject({
			profile: { schoolType: "prefer_not_to_say" },
			signUp: {
				unsafeMetadata: { schoolType: "prefer_not_to_say" },
			},
		});
	});

	test("rejects unsupported school types at the Clerk registration boundary", () => {
		const invalidPayload = {
			...getOnboardingRegistrationPayload(answers()),
			schoolType: "Goethe-Gymnasium Dresden",
		};

		expect(() =>
			prepareClerkRegistration(
				invalidPayload as unknown as ClerkRegistrationInput,
			),
		).toThrow("Bitte wähle eine gültige Schulart aus.");
	});

	test("rejects unsupported states at the Clerk registration boundary", () => {
		const registrationPayload = getOnboardingRegistrationPayload(
			answers({ state: "  Atlantis  " }),
		);

		expect(() => prepareClerkRegistration(registrationPayload)).toThrow(
			"Bitte wähle ein gültiges Bundesland aus.",
		);
	});
});
