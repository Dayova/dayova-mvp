import { describe, expect, test } from "vitest";
import {
	EMPTY_ONBOARDING_ANSWERS,
	formatBirthDate,
	getAgeFromBirthDate,
	getPersistableOnboardingAnswers,
	getRegistrationPayload,
	isStepComplete,
	ONBOARDING_STEPS,
	parseBirthDate,
	validateStep,
} from "./onboarding-flow";

describe("onboarding flow", () => {
	test("keeps the required answer fields in the registration flow", () => {
		const fields = ONBOARDING_STEPS.flatMap((step) =>
			"field" in step ? [step.field] : [],
		);

		expect(fields).toEqual([
			"studyTime",
			"strength",
			"challenge",
			"goal",
			"state",
			"name",
			"email",
			"birthDate",
		]);
		expect(ONBOARDING_STEPS.at(-1)?.kind).toBe("password");
	});

	test("disables answer steps until their public answer field is filled", () => {
		const selectStep = ONBOARDING_STEPS.find(
			(step) => step.kind === "select" && step.field === "studyTime",
		);
		if (!selectStep) throw new Error("Missing study time step.");

		expect(isStepComplete(selectStep, EMPTY_ONBOARDING_ANSWERS)).toBe(false);
		expect(
			isStepComplete(selectStep, {
				...EMPTY_ONBOARDING_ANSWERS,
				studyTime: "30 bis 60 Min.",
			}),
		).toBe(true);
	});

	test("validates profile fields before account creation", () => {
		const nameStep = ONBOARDING_STEPS.find(
			(step) => step.kind === "profile" && step.field === "name",
		);
		const emailStep = ONBOARDING_STEPS.find(
			(step) => step.kind === "profile" && step.field === "email",
		);
		const passwordStep = ONBOARDING_STEPS.find(
			(step) => step.kind === "password",
		);
		if (!nameStep || !emailStep || !passwordStep) {
			throw new Error("Missing profile/password steps.");
		}

		expect(validateStep(nameStep, EMPTY_ONBOARDING_ANSWERS)).toHaveProperty(
			"name",
		);
		expect(
			validateStep(emailStep, {
				...EMPTY_ONBOARDING_ANSWERS,
				email: "not-an-email",
			}),
		).toHaveProperty("email");
		expect(
			validateStep(passwordStep, {
				...EMPTY_ONBOARDING_ANSWERS,
				password: "short",
			}),
		).toHaveProperty("password");
	});

	test("formats birthdate and requires a learner age of at least six", () => {
		const today = new Date(2026, 6, 5);
		const oldEnough = new Date(2018, 6, 5);
		const tooYoung = new Date(2022, 6, 5);
		const birthDateStep = ONBOARDING_STEPS.find(
			(step) => step.kind === "profile" && step.field === "birthDate",
		);
		if (!birthDateStep) throw new Error("Missing birthdate step.");

		expect(formatBirthDate(oldEnough)).toBe("05.07.2018");
		expect(parseBirthDate("05.07.2018")?.getFullYear()).toBe(2018);
		expect(getAgeFromBirthDate(oldEnough, today)).toBe(8);
		expect(
			validateStep(
				birthDateStep,
				{ ...EMPTY_ONBOARDING_ANSWERS, birthDate: formatBirthDate(tooYoung) },
				today,
			),
		).toHaveProperty("birthDate");
		expect(
			validateStep(
				birthDateStep,
				{ ...EMPTY_ONBOARDING_ANSWERS, birthDate: formatBirthDate(oldEnough) },
				today,
			),
		).toEqual({});
	});

	test("normalizes the final Clerk registration payload", () => {
		expect(
			getRegistrationPayload({
				...EMPTY_ONBOARDING_ANSWERS,
				name: "  Fabius Schurig  ",
				email: "  FABIUS@EXAMPLE.DE ",
				birthDate: "05.07.2018",
				password: "supersecret",
			}),
		).toEqual({
			name: "Fabius Schurig",
			email: "fabius@example.de",
			birthDate: "05.07.2018",
			password: "supersecret",
		});
	});

	test("keeps Convex onboarding persistence scoped to answer fields", () => {
		expect(
			getPersistableOnboardingAnswers({
				studyTime: "30 bis 60 Min.",
				strength: "Mathematik",
				challenge: "Organisation",
				goal: "Mehr Struktur",
				state: "Bayern",
				name: "Fabius",
				email: "fabius@example.de",
				birthDate: "05.07.2018",
				password: "supersecret",
			}),
		).toEqual({
			studyTime: "30 bis 60 Min.",
			strength: "Mathematik",
			challenge: "Organisation",
			goal: "Mehr Struktur",
			state: "Bayern",
		});
	});
});
