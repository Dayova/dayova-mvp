import { describe, expect, test } from "vitest";
import {
	getOnboardingOptionLabel,
	getOnboardingPayoff,
	ONBOARDING_CHALLENGE_OPTIONS,
} from "./onboarding-personalization";

describe("onboarding personalization", () => {
	test("turns the learner's actual inputs into a visible payoff", () => {
		expect(
			getOnboardingPayoff({
				name: "  Lina Beispiel ",
				studyTime: "20",
				challenge: "unclear_start",
				goal: "reduce_stress",
			}),
		).toEqual({
			heading: "Lina, daraus wird dein persönlicher Weg.",
			body: "Dayova plant mit deinen 20 Minuten mit einer eindeutigen Reihenfolge statt Stoffchaos, damit du mit weniger Druck lernen kannst.",
		});
	});

	test("resolves stable keys separately from localized labels", () => {
		expect(
			getOnboardingOptionLabel(ONBOARDING_CHALLENGE_OPTIONS, "procrastination"),
		).toBe("Ich schiebe den Start auf");
	});
});
